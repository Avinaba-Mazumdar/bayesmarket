package ws_test

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Avinaba-Mazumdar/bayesmarket/internal/transport/ws"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func TestTradeExecution_WebSocketBroadcast(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()
	defer hub.Stop()

	wsHandler := ws.NewWSHandler(hub, "*", false)

	router := gin.New()
	router.GET("/ws/markets/:id", wsHandler.HandleMarketWS)

	server := httptest.NewServer(router)
	defer server.Close()

	marketID := "2d193798-75c1-4b19-bf93-9c7625807914"
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/markets/" + marketID

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to dial WebSocket: %v", err)
	}
	defer conn.Close()

	time.Sleep(50 * time.Millisecond)

	// Simulate trade handler dispatching PRICE_UPDATE and TRADE_EVENT
	now := time.Now().UTC().Format(time.RFC3339)
	hub.BroadcastPriceUpdate(ws.PriceUpdateMessage{
		MarketID: marketID,
		YesPrice: "0.72500000",
		NoPrice:  "0.27500000",
		Reserves: &ws.ReservesPayload{
			Yes: "7500.00000000",
			No:  "17500.00000000",
		},
		TotalVolumeUSDC: "15000.00000000",
		Timestamp:       now,
	})

	hub.BroadcastTradeEvent(ws.TradeEventMessage{
		TradeID:    "trade-e2e-1234",
		MarketID:   marketID,
		TradeType:  "BUY",
		Outcome:    "YES",
		Shares:     "138.67403315",
		Price:      "0.72111554",
		AmountUSDC: "100.00000000",
		Timestamp:  now,
	})

	// 1. Verify PRICE_UPDATE frame
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, priceBytes, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read PRICE_UPDATE frame: %v", err)
	}

	var priceUpdate ws.PriceUpdateMessage
	if err := json.Unmarshal(priceBytes, &priceUpdate); err != nil {
		t.Fatalf("Failed to decode PRICE_UPDATE frame: %v", err)
	}
	if priceUpdate.Type != ws.MessageTypePriceUpdate {
		t.Fatalf("Expected PRICE_UPDATE type, got %s", priceUpdate.Type)
	}
	if priceUpdate.YesPrice != "0.72500000" || priceUpdate.NoPrice != "0.27500000" {
		t.Fatalf("Price mismatch: yes=%s, no=%s", priceUpdate.YesPrice, priceUpdate.NoPrice)
	}
	if priceUpdate.Reserves == nil || priceUpdate.Reserves.Yes != "7500.00000000" {
		t.Fatalf("Reserves mismatch: %+v", priceUpdate.Reserves)
	}

	// 2. Verify TRADE_EVENT frame
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, tradeBytes, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read TRADE_EVENT frame: %v", err)
	}

	var tradeEvent ws.TradeEventMessage
	if err := json.Unmarshal(tradeBytes, &tradeEvent); err != nil {
		t.Fatalf("Failed to decode TRADE_EVENT frame: %v", err)
	}
	if tradeEvent.Type != ws.MessageTypeTradeEvent {
		t.Fatalf("Expected TRADE_EVENT type, got %s", tradeEvent.Type)
	}
	if tradeEvent.TradeID != "trade-e2e-1234" || tradeEvent.TradeType != "BUY" || tradeEvent.Shares != "138.67403315" {
		t.Fatalf("TradeEvent mismatch: %+v", tradeEvent)
	}
}
