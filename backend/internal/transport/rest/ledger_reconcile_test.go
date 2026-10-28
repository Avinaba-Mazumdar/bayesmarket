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

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
)

// TestLedgerReconciliation drives a market through its whole lifecycle via the API (seed, user
// seeds, buys on both sides, a partial sell, early resolution) and checks after every step that
// each snapshot column equals the sum of its ledger account and that every transaction balances.
func TestLedgerReconciliation(t *testing.T) {
	pool, cfg, router := getTestEnv(t)
	defer pool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	adminToken := getSuperadminToken(t, pool, cfg)
	call := func(method, url, token, idempKey string, payload interface{}) (int, map[string]interface{}) {
		var body []byte
		if payload != nil {
			body, _ = json.Marshal(payload)
		}
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(method, url, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		if idempKey != "" {
			req.Header.Set("Idempotency-Key", idempKey)
		}
		router.ServeHTTP(w, req)
		var out map[string]interface{}
		_ = json.Unmarshal(w.Body.Bytes(), &out)
		return w.Code, out
	}
	key := func(prefix string) string { return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano()) }

	// Market seeded from the treasury
	code, created := call(http.MethodPost, "/api/v1/admin/markets", adminToken, "", map[string]string{
		"title": fmt.Sprintf("Ledger reconciliation market %d", time.Now().UnixNano()), "description": "Reconciliation",
		"category": "macro", "resolution_source": "https://example.com", "resolution_date": time.Now().Add(48 * time.Hour).UTC().Format(time.RFC3339),
		"initial_collateral_usdc": "10000.12345678", "initial_probability_yes": "0.37",
	})
	if code != http.StatusCreated {
		t.Fatalf("create market: %d %v", code, created)
	}
	marketID := created["id"].(string)

	// Two traders seeded from the treasury
	type trader struct{ id, token string }
	var traders []trader
	for i := 0; i < 2; i++ {
		code, auth := call(http.MethodPost, "/api/v1/auth/guest", "", "", nil)
		if code != http.StatusOK && code != http.StatusCreated {
			t.Fatalf("guest auth: %d %v", code, auth)
		}
		traders = append(traders, trader{auth["user"].(map[string]interface{})["id"].(string), auth["token"].(string)})
	}
	defer func() {
		bg := context.Background()
		_, _ = pool.Exec(bg, `DELETE FROM ledger_entries WHERE transaction_id IN (
			SELECT transaction_id FROM ledger_entries WHERE market_id = $1 OR user_id::text = ANY($2::text[]))`,
			marketID, []string{traders[0].id, traders[1].id})
		_, _ = pool.Exec(bg, "DELETE FROM markets WHERE id = $1", marketID)
		_, _ = pool.Exec(bg, "DELETE FROM idempotency_keys WHERE actor_id::text = ANY($1::text[])", []string{traders[0].id, traders[1].id})
		_, _ = pool.Exec(bg, "DELETE FROM users WHERE id::text = ANY($1::text[])", []string{traders[0].id, traders[1].id})
	}()

	reconcile := func(step string) {
		t.Helper()
		assertReconciled(t, ctx, pool, step, marketID, []string{traders[0].id, traders[1].id})
	}
	reconcile("after seeding")

	order := func(tr trader, outcome, amount string) {
		code, body := call(http.MethodPost, "/api/v1/markets/"+marketID+"/orders", tr.token, key("rec-buy"),
			map[string]string{"outcome": outcome, "amount_usdc": amount, "min_shares_out": "0.00000001"})
		if code != http.StatusCreated {
			t.Fatalf("buy %s %s: %d %v", outcome, amount, code, body)
		}
	}
	order(traders[0], "YES", "211.11111111")
	order(traders[1], "NO", "97.3")
	order(traders[0], "NO", "13.00000007")
	reconcile("after buys")

	var held decimal.Decimal
	_ = pool.QueryRow(ctx, "SELECT shares_owned FROM user_positions WHERE user_id = $1 AND market_id = $2 AND outcome = 'YES'", traders[0].id, marketID).Scan(&held)
	code, body := call(http.MethodPost, "/api/v1/portfolio/cashout", traders[0].token, key("rec-sell"), map[string]string{
		"market_id": marketID, "outcome": "YES", "shares": held.Div(decimal.NewFromInt(3)).Truncate(8).StringFixed(8), "min_payout_usdc": "0.00000001",
	})
	if code != http.StatusOK {
		t.Fatalf("partial sell: %d %v", code, body)
	}
	reconcile("after partial sell")

	code, body = call(http.MethodPost, "/api/v1/admin/markets/"+marketID+"/resolve", adminToken, key("rec-resolve"),
		map[string]interface{}{"winning_outcome": "NO", "oracle_proof": "https://example.com/evidence/official-release", "resolve_early": true})
	if code != http.StatusOK {
		t.Fatalf("resolve: %d %v", code, body)
	}
	reconcile("after resolution")
}

func assertReconciled(t *testing.T, ctx context.Context, pool *pgxpool.Pool, step, marketID string, userIDs []string) {
	t.Helper()

	// 1. Every transaction touching this market or these users nets to zero per asset
	var unbalanced int
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM (
			SELECT transaction_id, asset FROM ledger_entries
			WHERE transaction_id IN (SELECT transaction_id FROM ledger_entries WHERE market_id = $1 OR user_id::text = ANY($2::text[]))
			GROUP BY transaction_id, asset HAVING SUM(delta) <> 0
		) x;
	`, marketID, userIDs).Scan(&unbalanced); err != nil {
		t.Fatalf("%s: balance query: %v", step, err)
	}
	if unbalanced != 0 {
		t.Errorf("%s: %d unbalanced (transaction, asset) pairs", step, unbalanced)
	}

	// 2. Pool snapshot == ledger
	var collateral, rYes, rNo, ledgerCollateral, ledgerYes, ledgerNo decimal.Decimal
	if err := pool.QueryRow(ctx, `
		SELECT p.collateral_reserve, p.reserve_yes, p.reserve_no,
			COALESCE(SUM(l.delta) FILTER (WHERE l.account = 'pool_collateral'), 0),
			COALESCE(SUM(l.delta) FILTER (WHERE l.account = 'pool_reserve' AND l.asset = 'YES'), 0),
			COALESCE(SUM(l.delta) FILTER (WHERE l.account = 'pool_reserve' AND l.asset = 'NO'), 0)
		FROM liquidity_pools p LEFT JOIN ledger_entries l ON l.market_id = p.market_id
		WHERE p.market_id = $1
		GROUP BY p.collateral_reserve, p.reserve_yes, p.reserve_no;
	`, marketID).Scan(&collateral, &rYes, &rNo, &ledgerCollateral, &ledgerYes, &ledgerNo); err != nil {
		t.Fatalf("%s: pool query: %v", step, err)
	}
	if !collateral.Equal(ledgerCollateral) || !rYes.Equal(ledgerYes) || !rNo.Equal(ledgerNo) {
		t.Errorf("%s: pool drift: collateral %s vs ledger %s, reserve_yes %s vs %s, reserve_no %s vs %s",
			step, collateral, ledgerCollateral, rYes, ledgerYes, rNo, ledgerNo)
	}

	// k_invariant is maintained on every reserve change (L12)
	var kStale bool
	if err := pool.QueryRow(ctx, "SELECT k_invariant <> reserve_yes * reserve_no FROM liquidity_pools WHERE market_id = $1", marketID).Scan(&kStale); err != nil {
		t.Fatalf("%s: k_invariant query: %v", step, err)
	}
	if kStale {
		t.Errorf("%s: k_invariant does not equal reserve_yes * reserve_no", step)
	}

	// 3. Each user's cash and positions == ledger
	for _, uid := range userIDs {
		var cash, ledgerCash decimal.Decimal
		if err := pool.QueryRow(ctx, `
			SELECT u.cash_balance, COALESCE((SELECT SUM(delta) FROM ledger_entries WHERE user_id = u.id AND account = 'user_cash'), 0)
			FROM users u WHERE u.id = $1;
		`, uid).Scan(&cash, &ledgerCash); err != nil {
			t.Fatalf("%s: cash query: %v", step, err)
		}
		if !cash.Equal(ledgerCash) {
			t.Errorf("%s: user %s cash %s vs ledger %s", step, uid, cash, ledgerCash)
		}

		var mismatches int
		if err := pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM user_positions p
			WHERE p.user_id = $1 AND p.market_id = $2 AND p.shares_owned <> COALESCE((
				SELECT SUM(delta) FROM ledger_entries
				WHERE user_id = p.user_id AND market_id = p.market_id AND account = 'position_' || lower(p.outcome)
			), 0);
		`, uid, marketID).Scan(&mismatches); err != nil {
			t.Fatalf("%s: position query: %v", step, err)
		}
		if mismatches != 0 {
			t.Errorf("%s: user %s has %d positions that differ from the ledger", step, uid, mismatches)
		}
	}
}
