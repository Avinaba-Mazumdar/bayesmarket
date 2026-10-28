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

// TestAdminResolveAtScale settles one market with many winning and losing positions in a single resolution.
// Each winning share pays 1 USDC, every position is cleared, and each winner is credited exactly once.
func TestAdminResolveAtScale(t *testing.T) {
	pool, cfg, router := getTestEnv(t)
	defer pool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	const holders = 200
	const sharesPerWinner = 10

	marketID := uuid.New()
	slug := fmt.Sprintf("test-resolve-scale-%d", time.Now().UnixNano())
	if _, err := pool.Exec(ctx, `
		INSERT INTO markets (id, slug, title, description, category, resolution_source, resolution_date, status)
		VALUES ($1, $2, 'Test Resolution At Scale', 'Many positions settle in one resolution', 'macro', 'Oracle Official', NOW() + INTERVAL '1 day', 'active');
	`, marketID, slug); err != nil {
		t.Fatalf("Failed to create test market: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO liquidity_pools (market_id, reserve_yes, reserve_no, collateral_reserve, k_invariant, total_volume_usdc)
		VALUES ($1, 10000.00000000, 10000.00000000, 20000.00000000, 100000000.00000000, 0.00000000);
	`, marketID); err != nil {
		t.Fatalf("Failed to create test liquidity pool: %v", err)
	}

	winners := make([]uuid.UUID, 0, holders)
	for i := 0; i < holders; i++ {
		winnerID := uuid.New()
		loserID := uuid.New()
		for _, uid := range []uuid.UUID{winnerID, loserID} {
			if _, err := pool.Exec(ctx, `INSERT INTO users (id, is_guest, cash_balance) VALUES ($1, true, 100.00000000);`, uid); err != nil {
				t.Fatalf("Failed to insert test user: %v", err)
			}
		}
		insertPosition := `
			INSERT INTO user_positions (user_id, market_id, outcome, shares_owned, avg_buy_price, total_invested_usdc)
			VALUES ($1, $2, $3, 10.00000000, 0.50000000, 5.00000000);
		`
		if _, err := pool.Exec(ctx, insertPosition, winnerID, marketID, "YES"); err != nil {
			t.Fatalf("Failed to insert winner position: %v", err)
		}
		if _, err := pool.Exec(ctx, insertPosition, loserID, marketID, "NO"); err != nil {
			t.Fatalf("Failed to insert loser position: %v", err)
		}
		winners = append(winners, winnerID)
	}

	superadminToken := getSuperadminToken(t, pool, cfg)
	resolvePayload := `{"winning_outcome":"YES","oracle_proof":"https://www.bls.gov/news.release/empsit.nr0.htm","resolve_early":true}`
	url := fmt.Sprintf("/api/v1/admin/markets/%s/resolve", marketID.String())

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, url, bytes.NewBufferString(resolvePayload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+superadminToken)
	req.Header.Set("Idempotency-Key", fmt.Sprintf("resolve-scale-%d", time.Now().UnixNano()))
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected resolution status 200 OK, got %d. Body: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Status          string `json:"status"`
		WinningOutcome  string `json:"winning_outcome"`
		TotalPayoutUSDC string `json:"total_payout_usdc"`
		WinnersCredited int    `json:"winners_credited"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to decode resolve response: %v", err)
	}

	if resp.Status != "resolved" || resp.WinningOutcome != "YES" || resp.WinnersCredited != holders {
		t.Errorf("Unexpected resolve response: %+v", resp)
	}
	payout, err := decimal.NewFromString(resp.TotalPayoutUSDC)
	if err != nil || !payout.Equal(decimal.NewFromInt(holders*sharesPerWinner)) {
		t.Errorf("Expected total payout %d, got %q (err %v)", holders*sharesPerWinner, resp.TotalPayoutUSDC, err)
	}

	var remaining int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM user_positions WHERE market_id = $1 AND shares_owned <> 0;`, marketID).Scan(&remaining); err != nil {
		t.Fatalf("Failed to count remaining positions: %v", err)
	}
	if remaining != 0 {
		t.Errorf("Expected no positions with shares after settlement, got %d", remaining)
	}

	expectedCash := decimal.NewFromInt(100 + sharesPerWinner)
	for _, winnerID := range winners {
		var cash decimal.Decimal
		if err := pool.QueryRow(ctx, `SELECT cash_balance FROM users WHERE id = $1;`, winnerID).Scan(&cash); err != nil {
			t.Fatalf("Failed to read winner balance: %v", err)
		}
		if !cash.Equal(expectedCash) {
			t.Errorf("Winner %s: expected cash %s, got %s", winnerID, expectedCash, cash)
			break
		}
	}
}
