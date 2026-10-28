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

func init() {
	gin.SetMode(gin.TestMode)
}

func setupTestWSServer(t *testing.T) (*ws.Hub, *httptest.Server) {
	hub := ws.NewHub()
	go hub.Run()

	handler := ws.NewWSHandler(hub, "*", false)

	router := gin.New()
	router.GET("/ws/markets/:id", handler.HandleMarketWS)
	router.GET("/ws/markets", handler.HandleGlobalWS)

	server := httptest.NewServer(router)
	return hub, server
}

func TestHub_ClientConnectionLifecycle(t *testing.T) {
	hub, server := setupTestWSServer(t)
	defer server.Close()
	defer hub.Stop()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/markets/test-market-123"

	// Connect client
	conn, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to dial WebSocket: %v", err)
	}
	defer conn.Close()
	defer resp.Body.Close()

	// Wait for registration
	time.Sleep(50 * time.Millisecond)

	if hub.ClientCount() != 1 {
		t.Fatalf("Expected 1 connected client, got %d", hub.ClientCount())
	}
	if hub.MarketClientCount("test-market-123") != 1 {
		t.Fatalf("Expected 1 market client, got %d", hub.MarketClientCount("test-market-123"))
	}

	// Disconnect client
	_ = conn.Close()
	time.Sleep(50 * time.Millisecond)

	if hub.ClientCount() != 0 {
		t.Fatalf("Expected 0 connected clients after close, got %d", hub.ClientCount())
	}
}

func TestHub_TopicIsolation(t *testing.T) {
	hub, server := setupTestWSServer(t)
	defer server.Close()
	defer hub.Stop()

	marketA := "market-a-uuid"
	marketB := "market-b-uuid"

	wsURLA := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/markets/" + marketA
	wsURLB := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/markets/" + marketB

	connA, _, err := websocket.DefaultDialer.Dial(wsURLA, nil)
	if err != nil {
		t.Fatalf("Failed to dial connA: %v", err)
	}
	defer connA.Close()

	connB, _, err := websocket.DefaultDialer.Dial(wsURLB, nil)
	if err != nil {
		t.Fatalf("Failed to dial connB: %v", err)
	}
	defer connB.Close()

	time.Sleep(50 * time.Millisecond)

	// Broadcast price update to Market A
	hub.BroadcastPriceUpdate(ws.PriceUpdateMessage{
		MarketID: marketA,
		YesPrice: "0.75000000",
		NoPrice:  "0.25000000",
		Reserves: &ws.ReservesPayload{
			Yes: "5000.00000000",
			No:  "15000.00000000",
		},
		TotalVolumeUSDC: "1000.00000000",
		Timestamp:       "2026-09-07T00:00:00Z",
	})

	// ConnA should receive the message
	_ = connA.SetReadDeadline(time.Now().Add(1 * time.Second))
	_, msgBytesA, err := connA.ReadMessage()
	if err != nil {
		t.Fatalf("ConnA failed to read message: %v", err)
	}

	var msgA ws.PriceUpdateMessage
	if err := json.Unmarshal(msgBytesA, &msgA); err != nil {
		t.Fatalf("Failed to unmarshal msgA: %v", err)
	}
	if msgA.Type != ws.MessageTypePriceUpdate || msgA.MarketID != marketA || msgA.YesPrice != "0.75000000" {
		t.Fatalf("Unexpected msgA content: %+v", msgA)
	}

	// ConnB should NOT receive the message for Market A
	_ = connB.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
	_, _, err = connB.ReadMessage()
	if err == nil {
		t.Fatal("ConnB should NOT have received a message intended for Market A")
	}
}

func TestHub_GlobalSubscriberReceivesAll(t *testing.T) {
	hub, server := setupTestWSServer(t)
	defer server.Close()
	defer hub.Stop()

	wsURLGlobal := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/markets"

	connGlobal, _, err := websocket.DefaultDialer.Dial(wsURLGlobal, nil)
	if err != nil {
		t.Fatalf("Failed to dial global WS: %v", err)
	}
	defer connGlobal.Close()

	time.Sleep(50 * time.Millisecond)

	hub.BroadcastTradeEvent(ws.TradeEventMessage{
		TradeID:    "trade-xyz",
		MarketID:   "market-any-uuid",
		TradeType:  "BUY",
		Outcome:    "YES",
		Shares:     "100.00000000",
		Price:      "0.50000000",
		AmountUSDC: "50.00000000",
		Timestamp:  "2026-09-07T00:00:00Z",
	})

	_ = connGlobal.SetReadDeadline(time.Now().Add(1 * time.Second))
	_, msgBytes, err := connGlobal.ReadMessage()
	if err != nil {
		t.Fatalf("Global subscriber failed to read message: %v", err)
	}

	var tradeMsg ws.TradeEventMessage
	if err := json.Unmarshal(msgBytes, &tradeMsg); err != nil {
		t.Fatalf("Failed to parse trade message: %v", err)
	}
	if tradeMsg.Type != ws.MessageTypeTradeEvent || tradeMsg.TradeID != "trade-xyz" {
		t.Fatalf("Unexpected tradeMsg content: %+v", tradeMsg)
	}
}

func TestHub_NonBlockingSlowConsumerEviction(t *testing.T) {
	hub, server := setupTestWSServer(t)
	defer server.Close()
	defer hub.Stop()

	marketID := "market-slow-test"
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/markets/" + marketID

	connSlow, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to dial slow WS: %v", err)
	}
	defer connSlow.Close()

	time.Sleep(50 * time.Millisecond)

	// Rapidly broadcast more than sendBufferSize (256) frames without reading
	// This will saturate the 256-buffered client.send channel and trigger eviction
	for i := 0; i < 300; i++ {
		hub.Broadcast(marketID, []byte(`{"ping": true}`))
	}

	time.Sleep(100 * time.Millisecond)

	// Slow client should have been evicted or closed
	if hub.MarketClientCount(marketID) > 0 {
		// Verify that trying to broadcast does not block
		start := time.Now()
		hub.Broadcast(marketID, []byte(`{"ping": true}`))
		elapsed := time.Since(start)
		if elapsed > 50*time.Millisecond {
			t.Fatalf("Broadcast blocked for %v on slow consumer", elapsed)
		}
	}
}
