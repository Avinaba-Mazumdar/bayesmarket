package rest_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// TestMarketHistoryFromRecordedTrades checks that history and recent trades come only from recorded
// trades, that the last history point equals the post-trade probability, and that trader identities
// are never exposed (U1, U5).
func TestMarketHistoryFromRecordedTrades(t *testing.T) {
	pool, _, router := getTestEnv(t)
	defer pool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	marketID := uuid.New()
	slug := fmt.Sprintf("test-history-%d", time.Now().UnixNano())
	if _, err := pool.Exec(ctx, `
		INSERT INTO markets (id, slug, title, description, category, resolution_source, resolution_date, status)
		VALUES ($1, $2, 'History test market', 'History', 'macro', 'Oracle', NOW() + INTERVAL '1 day', 'active');
	`, marketID, slug); err != nil {
		t.Fatalf("insert market: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO liquidity_pools (market_id, reserve_yes, reserve_no, collateral_reserve, k_invariant, total_volume_usdc)
		VALUES ($1, 5000, 5000, 10000, 25000000, 0);
	`, marketID); err != nil {
		t.Fatalf("insert pool: %v", err)
	}
	defer func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM ledger_entries WHERE market_id = $1", marketID)
		_, _ = pool.Exec(context.Background(), "DELETE FROM trades WHERE market_id = $1", marketID)
		_, _ = pool.Exec(context.Background(), "DELETE FROM markets WHERE id = $1", marketID)
	}()

	call := func(method, url, token, key string, body string) (int, []byte) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(method, url, bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		if key != "" {
			req.Header.Set("Idempotency-Key", key)
		}
		router.ServeHTTP(w, req)
		return w.Code, w.Body.Bytes()
	}

	// Empty history before any trade
	code, body := call(http.MethodGet, "/api/v1/markets/"+marketID.String()+"/history?range=1h", "", "", "")
	if code != http.StatusOK {
		t.Fatalf("history before trades: %d %s", code, body)
	}
	var empty MarketHistoryShape
	_ = json.Unmarshal(body, &empty)
	if len(empty.Points) != 0 {
		t.Errorf("expected no history before any trade, got %d points", len(empty.Points))
	}

	var auth struct {
		Token string `json:"token"`
	}
	_, authBody := call(http.MethodPost, "/api/v1/auth/guest", "", "", "")
	_ = json.Unmarshal(authBody, &auth)
	if auth.Token == "" {
		t.Fatalf("guest auth failed: %s", authBody)
	}

	for i, trade := range []struct{ outcome, amount string }{{"YES", "120"}, {"NO", "40"}} {
		payload := fmt.Sprintf(`{"outcome":%q,"amount_usdc":%q,"min_shares_out":"0.00000001"}`, trade.outcome, trade.amount)
		code, body := call(http.MethodPost, "/api/v1/markets/"+marketID.String()+"/orders", auth.Token, fmt.Sprintf("hist-%d-%d", i, time.Now().UnixNano()), payload)
		if code != http.StatusCreated {
			t.Fatalf("order %d: %d %s", i, code, body)
		}
	}

	var lastProb decimal.Decimal
	if err := pool.QueryRow(ctx, "SELECT yes_probability_after FROM trades WHERE market_id = $1 ORDER BY created_at DESC LIMIT 1", marketID).Scan(&lastProb); err != nil {
		t.Fatalf("read recorded probability: %v", err)
	}

	// 1. History is served by UUID and by slug, and its last point is the recorded post-trade probability
	for _, ref := range []string{marketID.String(), slug} {
		code, body := call(http.MethodGet, "/api/v1/markets/"+ref+"/history?range=24h", "", "", "")
		if code != http.StatusOK {
			t.Fatalf("history by %s: %d %s", ref, code, body)
		}
		var hist MarketHistoryShape
		if err := json.Unmarshal(body, &hist); err != nil {
			t.Fatalf("decode history: %v", err)
		}
		if len(hist.Points) == 0 {
			t.Fatalf("expected history points after trades (ref %s)", ref)
		}
		last := decimal.RequireFromString(hist.Points[len(hist.Points)-1].Probability)
		if !last.Equal(lastProb) {
			t.Errorf("last history point %s, recorded post-trade probability %s", last, lastProb)
		}
	}

	// 2. Recent trades: newest first, two rows, and no trader identity fields
	code, body = call(http.MethodGet, "/api/v1/markets/"+marketID.String()+"/trades?limit=10", "", "", "")
	if code != http.StatusOK {
		t.Fatalf("trades: %d %s", code, body)
	}
	var trades []map[string]interface{}
	if err := json.Unmarshal(body, &trades); err != nil {
		t.Fatalf("decode trades: %v", err)
	}
	if len(trades) != 2 {
		t.Fatalf("expected 2 trades, got %d", len(trades))
	}
	if trades[0]["outcome"] != "NO" {
		t.Errorf("expected newest trade first (NO), got %v", trades[0]["outcome"])
	}
	for _, tr := range trades {
		for _, forbidden := range []string{"user_id", "idempotency_key"} {
			if _, present := tr[forbidden]; present {
				t.Errorf("trade response leaks %s", forbidden)
			}
		}
	}

	// 3. Invalid ranges and unknown markets
	if code, _ := call(http.MethodGet, "/api/v1/markets/"+marketID.String()+"/history?range=5y", "", "", ""); code != http.StatusBadRequest {
		t.Errorf("expected 400 for range=5y, got %d", code)
	}
	if code, _ := call(http.MethodGet, "/api/v1/markets/"+uuid.New().String()+"/history", "", "", ""); code != http.StatusNotFound {
		t.Errorf("expected 404 for unknown market, got %d", code)
	}
}

// MarketHistoryShape mirrors the history response for decoding in tests.
type MarketHistoryShape struct {
	MarketID string `json:"market_id"`
	Range    string `json:"range"`
	Points   []struct {
		Time        string `json:"t"`
		Probability string `json:"p"`
	} `json:"points"`
}
