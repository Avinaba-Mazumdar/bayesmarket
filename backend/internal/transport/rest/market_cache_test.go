package rest_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Avinaba-Mazumdar/bayesmarket/internal/amm"
	"github.com/Avinaba-Mazumdar/bayesmarket/internal/transport/rest"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// A detail read caches non-active markets too; the quote cache must carry status and
// resolution date so cache hits can be re-checked for tradability (L8).
func TestMarketCacheQuoteStateCarriesTradability(t *testing.T) {
	cache := rest.NewMarketCache(time.Minute)
	id := uuid.New()
	resolution := time.Now().Add(-time.Hour).UTC().Truncate(time.Second)
	reserves := amm.PoolReserves{ReserveYes: decimal.NewFromInt(5), ReserveNo: decimal.NewFromInt(5), CollateralReserve: decimal.NewFromInt(10)}

	cache.SetMarket(id.String(), "suspended-market", rest.MarketSummaryResponse{
		ID: id.String(), Slug: "suspended-market", Title: "Suspended", Status: "suspended",
		ResolutionDate: resolution.Format(time.RFC3339),
	}, reserves, id)

	for _, key := range []string{id.String(), "suspended-market"} {
		state, ok := cache.GetQuoteState(key)
		if !ok {
			t.Fatalf("expected cache hit for %s", key)
		}
		if state.Status != "suspended" || !state.ResolutionDate.Equal(resolution) || state.MarketUUID != id {
			t.Errorf("%s: unexpected quote state %+v", key, state)
		}
	}

	cache.SetReserves(id.String(), "suspended-market", reserves, id, "active", resolution)
	if state, _ := cache.GetQuoteState("suspended-market"); state.Status != "active" {
		t.Errorf("SetReserves should refresh status, got %q", state.Status)
	}
}

func TestMarketCacheQuoteStateMissesWithoutStatus(t *testing.T) {
	cache := rest.NewMarketCache(time.Minute)
	if _, ok := cache.GetQuoteState("unknown"); ok {
		t.Error("expected miss for unknown market")
	}
}

// TestMarketListAndQuoteCacheCorrectness covers both L8 cache bugs against a live router:
// a ?limit=1 request must not shrink the cached list for other clients, and a market cached by
// a detail read while suspended must not be quotable.
func TestMarketListAndQuoteCacheCorrectness(t *testing.T) {
	pool, _, router := getTestEnv(t)
	defer pool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	var ids []uuid.UUID
	for i, status := range []string{"active", "active", "suspended"} {
		id := uuid.New()
		ids = append(ids, id)
		if _, err := pool.Exec(ctx, `
			INSERT INTO markets (id, slug, title, description, category, resolution_source, resolution_date, status)
			VALUES ($1, $2, 'Cache test market', 'Cache test', 'macro', 'Oracle', NOW() + INTERVAL '1 day', $3);
		`, id, fmt.Sprintf("cache-test-%d-%d", time.Now().UnixNano(), i), status); err != nil {
			t.Fatalf("insert market: %v", err)
		}
		if _, err := pool.Exec(ctx, `
			INSERT INTO liquidity_pools (market_id, reserve_yes, reserve_no, collateral_reserve, k_invariant)
			VALUES ($1, 5000, 5000, 10000, 25000000);
		`, id); err != nil {
			t.Fatalf("insert pool: %v", err)
		}
	}
	defer func() {
		for _, id := range ids {
			_, _ = pool.Exec(context.Background(), "DELETE FROM markets WHERE id = $1", id)
		}
	}()

	get := func(url string) (int, []byte) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, url, nil)
		router.ServeHTTP(w, req)
		return w.Code, w.Body.Bytes()
	}

	// 1. A limit=1 request fills the cache first; the next unlimited request must see every market
	if code, body := get("/api/v1/markets?category=macro&limit=1"); code != http.StatusOK {
		t.Fatalf("limit=1 list: %d %s", code, body)
	} else {
		var page []map[string]interface{}
		_ = json.Unmarshal(body, &page)
		if len(page) != 1 {
			t.Errorf("expected exactly 1 market for limit=1, got %d", len(page))
		}
	}
	_, body := get("/api/v1/markets?category=macro")
	var all []map[string]interface{}
	_ = json.Unmarshal(body, &all)
	found := 0
	for _, m := range all {
		if m["id"] == ids[0].String() || m["id"] == ids[1].String() {
			found++
		}
	}
	if found != 2 {
		t.Errorf("cached list was truncated by an earlier ?limit: found %d of 2 active test markets in %d results", found, len(all))
	}

	// 2. Detail read caches the suspended market; a quote must still be refused
	if code, _ := get("/api/v1/markets/" + ids[2].String()); code != http.StatusOK {
		t.Fatalf("detail read of suspended market: %d", code)
	}
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/markets/"+ids[2].String()+"/quote",
		strings.NewReader(`{"action":"BUY","outcome":"YES","amount_usdc":"10"}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "market_not_active") {
		t.Errorf("expected cached suspended market to refuse quotes, got %d %s", w.Code, w.Body.String())
	}
}
