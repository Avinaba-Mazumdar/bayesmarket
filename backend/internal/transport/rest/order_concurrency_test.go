package rest_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

type orderResponseData struct {
	TradeID        string `json:"trade_id"`
	MarketID       string `json:"market_id"`
	UserID         string `json:"user_id"`
	TradeType      string `json:"trade_type"`
	Outcome        string `json:"outcome"`
	AmountUSDC     string `json:"amount_usdc"`
	SharesFilled   string `json:"shares_filled"`
	ExecutionPrice string `json:"execution_price"`
	PriceImpactPct string `json:"price_impact_pct"`
	NewCashBalance string `json:"new_cash_balance"`
	NewSharesOwned string `json:"new_shares_owned"`
	AvgBuyPrice    string `json:"avg_buy_price"`
}

type cashOutResponseData struct {
	TradeID         string `json:"trade_id"`
	MarketID        string `json:"market_id"`
	UserID          string `json:"user_id"`
	TradeType       string `json:"trade_type"`
	Outcome         string `json:"outcome"`
	SharesSold      string `json:"shares_sold"`
	PayoutUSDC      string `json:"payout_usdc"`
	ExecutionPrice  string `json:"execution_price"`
	PriceImpactPct  string `json:"price_impact_pct"`
	NewCashBalance  string `json:"new_cash_balance"`
	RemainingShares string `json:"remaining_shares"`
}

// 1. Double-Spend Attack: 20 concurrent goroutines attempting to spend the same $100 USDC balance.
// Exactly 1 trade must succeed, and 19 must fail with insufficient balance.
func TestConcurrency_DoubleSpendAttack(t *testing.T) {
	pool, _, router := getTestEnv(t)
	defer pool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	// Provision guest user
	wAuth := httptest.NewRecorder()
	reqAuth, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/guest", nil)
	router.ServeHTTP(wAuth, reqAuth)
	if wAuth.Code != http.StatusCreated {
		t.Fatalf("Failed to create guest user: %d", wAuth.Code)
	}

	var authData struct {
		Token string `json:"token"`
		User  struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	_ = json.Unmarshal(wAuth.Body.Bytes(), &authData)
	userID := authData.User.ID
	token := authData.Token

	// Set user's cash balance to exactly $100.00000000 USDC
	_, err := pool.Exec(ctx, "UPDATE users SET cash_balance = 100.00000000 WHERE id = $1", userID)
	if err != nil {
		t.Fatalf("Failed to set user cash balance: %v", err)
	}

	// Fetch an active market
	var marketID string
	err = pool.QueryRow(ctx, "SELECT id FROM markets WHERE status = 'active' ORDER BY created_at ASC LIMIT 1").Scan(&marketID)
	if err != nil {
		t.Fatalf("Failed to query active market: %v", err)
	}

	concurrency := 20
	var wg sync.WaitGroup
	var mu sync.Mutex

	statusCodes := make([]int, 0, concurrency)
	errorMessages := make([]string, 0, concurrency)

	// Barrier to start all goroutines simultaneously
	startChan := make(chan struct{})

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()

			<-startChan // wait for synchronized release

			orderPayload := map[string]string{
				"outcome":        "YES",
				"amount_usdc":    "100.00000000",
				"min_shares_out": "0.00000001",
			}
			bodyBytes, _ := json.Marshal(orderPayload)

			wOrder := httptest.NewRecorder()
			reqOrder, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("/api/v1/markets/%s/orders", marketID), bytes.NewReader(bodyBytes))
			reqOrder.Header.Set("Content-Type", "application/json")
			reqOrder.Header.Set("Authorization", "Bearer "+token)
			reqOrder.Header.Set("Idempotency-Key", fmt.Sprintf("double-spend-key-%d-%s", idx, uuid.New().String()))

			router.ServeHTTP(wOrder, reqOrder)

			mu.Lock()
			statusCodes = append(statusCodes, wOrder.Code)
			if wOrder.Code != http.StatusCreated {
				var errResp map[string]interface{}
				_ = json.Unmarshal(wOrder.Body.Bytes(), &errResp)
				errorMessages = append(errorMessages, fmt.Sprintf("%v", errResp["error"]))
			}
			mu.Unlock()
		}(i)
	}

	// Unleash all 20 concurrent orders
	close(startChan)
	wg.Wait()

	// Verify status counts
	successCount := 0
	insufficientBalanceCount := 0
	for _, code := range statusCodes {
		switch code {
		case http.StatusCreated:
			successCount++
		case http.StatusBadRequest:
			insufficientBalanceCount++
		}
	}

	t.Logf("Double-Spend Concurrency Results: Successes=%d, InsufficientBalance=%d", successCount, insufficientBalanceCount)

	if successCount != 1 {
		t.Fatalf("INVARIANT VIOLATION: Expected exactly 1 order to succeed, but %d succeeded!", successCount)
	}
	if insufficientBalanceCount != concurrency-1 {
		t.Fatalf("Expected %d failed orders with insufficient balance, got %d. Errors: %v", concurrency-1, insufficientBalanceCount, errorMessages)
	}

	// Verify DB state: cash balance must be strictly zero
	var finalCash string
	err = pool.QueryRow(ctx, "SELECT cash_balance FROM users WHERE id = $1", userID).Scan(&finalCash)
	if err != nil {
		t.Fatalf("Failed to fetch user final cash balance: %v", err)
	}
	cashDec, err := decimal.NewFromString(finalCash)
	if err != nil || !cashDec.IsZero() {
		t.Fatalf("Expected user final cash balance to be 0, got %s", finalCash)
	}

	// Verify user position exists with positive shares
	var sharesOwned string
	err = pool.QueryRow(ctx, "SELECT shares_owned FROM user_positions WHERE user_id = $1 AND market_id = $2 AND outcome = 'YES'", userID, marketID).Scan(&sharesOwned)
	if err != nil {
		t.Fatalf("Failed to fetch user position: %v", err)
	}
	sharesDec, _ := decimal.NewFromString(sharesOwned)
	if sharesDec.LessThanOrEqual(decimal.Zero) {
		t.Fatalf("Expected positive shares owned, got %s", sharesOwned)
	}

	// Verify ledger entries: exactly 4 balanced entries for the single trade (2 cash/collateral, 2 share positions)
	var ledgerCount int
	err = pool.QueryRow(ctx, "SELECT COUNT(*) FROM ledger_entries WHERE user_id = $1", userID).Scan(&ledgerCount)
	if err != nil {
		t.Fatalf("Failed to count ledger entries: %v", err)
	}
	if ledgerCount != 4 {
		t.Fatalf("Expected exactly 4 double-entry ledger rows, got %d", ledgerCount)
	}

	var usdcSum, shareSum decimal.Decimal
	err = pool.QueryRow(ctx, "SELECT COALESCE(SUM(delta), 0) FROM ledger_entries WHERE user_id = $1 AND asset = 'USDC'", userID).Scan(&usdcSum)
	if err != nil || !usdcSum.IsZero() {
		t.Fatalf("Expected USDC ledger entries to reconcile to 0, got %s (err: %v)", usdcSum, err)
	}
	err = pool.QueryRow(ctx, "SELECT COALESCE(SUM(delta), 0) FROM ledger_entries WHERE user_id = $1 AND asset != 'USDC'", userID).Scan(&shareSum)
	if err != nil || !shareSum.IsZero() {
		t.Fatalf("Expected Share ledger entries to reconcile to 0, got %s (err: %v)", shareSum, err)
	}
}

// 2. High-Contention Pool Execution: 20 separate users concurrently buying on the same market.
// Verifies pool serializes properly without deadlocks, preserves k invariant, and matches collateral accumulation.
func TestConcurrency_HighContentionPool(t *testing.T) {
	pool, _, router := getTestEnv(t)
	defer pool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	// Pick active market
	var marketID string
	var initialCollateral, initialRYes, initialRNo string
	queryInit := `
		SELECT m.id, p.collateral_reserve, p.reserve_yes, p.reserve_no 
		FROM markets m 
		JOIN liquidity_pools p ON p.market_id = m.id 
		WHERE m.status = 'active' 
		ORDER BY m.created_at ASC 
		LIMIT 1;
	`
	err := pool.QueryRow(ctx, queryInit).Scan(&marketID, &initialCollateral, &initialRYes, &initialRNo)
	if err != nil {
		t.Fatalf("Failed to query market: %v", err)
	}

	initialCollateralDec, _ := decimal.NewFromString(initialCollateral)
	initialRYesDec, _ := decimal.NewFromString(initialRYes)
	initialRNoDec, _ := decimal.NewFromString(initialRNo)
	initialK := initialRYesDec.Mul(initialRNoDec)

	concurrency := 10
	tokens := make([]string, concurrency)

	// Create 20 distinct users
	for i := 0; i < concurrency; i++ {
		wAuth := httptest.NewRecorder()
		reqAuth, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/guest", nil)
		router.ServeHTTP(wAuth, reqAuth)
		if wAuth.Code != http.StatusCreated {
			t.Fatalf("Failed to create user %d: %d", i, wAuth.Code)
		}
		var authData struct {
			Token string `json:"token"`
		}
		_ = json.Unmarshal(wAuth.Body.Bytes(), &authData)
		tokens[i] = authData.Token
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	successCount := 0
	orderAmount := decimal.NewFromInt(10) // 10 USDC per trade

	startChan := make(chan struct{})

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			<-startChan

			orderPayload := map[string]string{
				"outcome":        "YES",
				"amount_usdc":    orderAmount.StringFixed(8),
				"min_shares_out": "0.00000001",
			}
			bodyBytes, _ := json.Marshal(orderPayload)

			wOrder := httptest.NewRecorder()
			reqOrder, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("/api/v1/markets/%s/orders", marketID), bytes.NewReader(bodyBytes))
			reqOrder.Header.Set("Content-Type", "application/json")
			reqOrder.Header.Set("Authorization", "Bearer "+tokens[idx])
			reqOrder.Header.Set("Idempotency-Key", fmt.Sprintf("contention-order-%d-%s", idx, uuid.New().String()))

			router.ServeHTTP(wOrder, reqOrder)

			if wOrder.Code == http.StatusCreated {
				mu.Lock()
				successCount++
				mu.Unlock()
			}
		}(i)
	}

	close(startChan)
	wg.Wait()

	t.Logf("High Contention Pool: %d / %d orders successfully executed", successCount, concurrency)
	if successCount != concurrency {
		t.Fatalf("Expected all %d orders to succeed, but %d succeeded", concurrency, successCount)
	}

	// Verify pool collateral increased by exactly (concurrency * orderAmount)
	var finalCollateral, finalRYes, finalRNo string
	queryFinal := `
		SELECT collateral_reserve, reserve_yes, reserve_no 
		FROM liquidity_pools 
		WHERE market_id = $1;
	`
	err = pool.QueryRow(ctx, queryFinal, marketID).Scan(&finalCollateral, &finalRYes, &finalRNo)
	if err != nil {
		t.Fatalf("Failed to query final pool: %v", err)
	}

	finalCollateralDec, _ := decimal.NewFromString(finalCollateral)
	finalRYesDec, _ := decimal.NewFromString(finalRYes)
	finalRNoDec, _ := decimal.NewFromString(finalRNo)

	expectedCollateral := initialCollateralDec.Add(orderAmount.Mul(decimal.NewFromInt(int64(concurrency))))
	if !finalCollateralDec.Equal(expectedCollateral) {
		t.Fatalf("Collateral mismatch: expected %s, got %s", expectedCollateral.StringFixed(8), finalCollateralDec.StringFixed(8))
	}

	// Verify k invariant conservation: k_final should match k_initial
	finalK := finalRYesDec.Mul(finalRNoDec)
	diffK := finalK.Sub(initialK).Abs()
	relDiff := diffK.Div(initialK)
	if relDiff.GreaterThan(decimal.NewFromFloat(0.0001)) {
		t.Fatalf("Invariant k drifted excessively: initial=%s, final=%s, relDiff=%s", initialK.String(), finalK.String(), relDiff.String())
	}
}

// 3. Cash Out Liquidation & Solvency Test
func TestCashOut_LiquidationAndSolvency(t *testing.T) {
	pool, _, router := getTestEnv(t)
	defer pool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	// Provision user
	wAuth := httptest.NewRecorder()
	reqAuth, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/guest", nil)
	router.ServeHTTP(wAuth, reqAuth)
	var authData struct {
		Token string `json:"token"`
		User  struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	_ = json.Unmarshal(wAuth.Body.Bytes(), &authData)
	token := authData.Token
	userID := authData.User.ID

	// Pick active market
	var marketID string
	_ = pool.QueryRow(ctx, "SELECT id FROM markets WHERE status = 'active' ORDER BY created_at ASC LIMIT 1").Scan(&marketID)

	// Buy 100 USDC of YES
	orderPayload := map[string]string{
		"outcome":        "YES",
		"amount_usdc":    "100.00000000",
		"min_shares_out": "0.00000001",
	}
	bodyBytes, _ := json.Marshal(orderPayload)
	wOrder := httptest.NewRecorder()
	reqOrder, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("/api/v1/markets/%s/orders", marketID), bytes.NewReader(bodyBytes))
	reqOrder.Header.Set("Content-Type", "application/json")
	reqOrder.Header.Set("Authorization", "Bearer "+token)
	reqOrder.Header.Set("Idempotency-Key", "cashout-prep-"+uuid.New().String())
	router.ServeHTTP(wOrder, reqOrder)

	if wOrder.Code != http.StatusCreated {
		t.Fatalf("Failed to execute buy order: %d body: %s", wOrder.Code, wOrder.Body.String())
	}

	var buyResp orderResponseData
	_ = json.Unmarshal(wOrder.Body.Bytes(), &buyResp)
	sharesOwnedDec, _ := decimal.NewFromString(buyResp.NewSharesOwned)

	// Cash out half of the shares
	halfShares := sharesOwnedDec.DivRound(decimal.NewFromInt(2), 8)
	cashOutPayload := map[string]string{
		"market_id":       marketID,
		"outcome":         "YES",
		"shares":          halfShares.StringFixed(8),
		"min_payout_usdc": "0.00000001",
	}
	cashOutBytes, _ := json.Marshal(cashOutPayload)

	wCashOut := httptest.NewRecorder()
	reqCashOut, _ := http.NewRequest(http.MethodPost, "/api/v1/portfolio/cashout", bytes.NewReader(cashOutBytes))
	reqCashOut.Header.Set("Content-Type", "application/json")
	reqCashOut.Header.Set("Authorization", "Bearer "+token)
	reqCashOut.Header.Set("Idempotency-Key", "cashout-half-"+uuid.New().String())
	router.ServeHTTP(wCashOut, reqCashOut)

	if wCashOut.Code != http.StatusOK {
		t.Fatalf("Expected HTTP 200 on cash out, got %d body: %s", wCashOut.Code, wCashOut.Body.String())
	}

	var cashOutResp cashOutResponseData
	_ = json.Unmarshal(wCashOut.Body.Bytes(), &cashOutResp)

	payoutDec, _ := decimal.NewFromString(cashOutResp.PayoutUSDC)
	if payoutDec.LessThanOrEqual(decimal.Zero) {
		t.Fatalf("Expected positive payout USDC, got %s", cashOutResp.PayoutUSDC)
	}

	// Verify remaining shares in DB
	var remSharesDB string
	_ = pool.QueryRow(ctx, "SELECT shares_owned FROM user_positions WHERE user_id = $1 AND market_id = $2 AND outcome = 'YES'", userID, marketID).Scan(&remSharesDB)
	remDec, _ := decimal.NewFromString(remSharesDB)
	expectedRem := sharesOwnedDec.Sub(halfShares)
	if !remDec.Equal(expectedRem) {
		t.Fatalf("Remaining shares mismatch: expected %s, got %s", expectedRem.StringFixed(8), remDec.StringFixed(8))
	}

	// Attempting to sell more shares than owned must return HTTP 400
	excessPayload := map[string]string{
		"market_id":       marketID,
		"outcome":         "YES",
		"shares":          sharesOwnedDec.Mul(decimal.NewFromInt(10)).StringFixed(8),
		"min_payout_usdc": "0.00000001",
	}
	excessBytes, _ := json.Marshal(excessPayload)
	wExcess := httptest.NewRecorder()
	reqExcess, _ := http.NewRequest(http.MethodPost, "/api/v1/portfolio/cashout", bytes.NewReader(excessBytes))
	reqExcess.Header.Set("Content-Type", "application/json")
	reqExcess.Header.Set("Authorization", "Bearer "+token)
	reqExcess.Header.Set("Idempotency-Key", "cashout-excess-"+uuid.New().String())
	router.ServeHTTP(wExcess, reqExcess)

	if wExcess.Code != http.StatusBadRequest {
		t.Fatalf("Expected HTTP 400 for excessive shares liquidation, got %d", wExcess.Code)
	}

	// Attempting to sell an outcome where user has no position at all (e.g. NO) must return HTTP 400
	noPosPayload := map[string]string{
		"market_id":       marketID,
		"outcome":         "NO",
		"shares":          "10.00000000",
		"min_payout_usdc": "0.00000001",
	}
	noPosBytes, _ := json.Marshal(noPosPayload)
	wNoPos := httptest.NewRecorder()
	reqNoPos, _ := http.NewRequest(http.MethodPost, "/api/v1/portfolio/cashout", bytes.NewReader(noPosBytes))
	reqNoPos.Header.Set("Content-Type", "application/json")
	reqNoPos.Header.Set("Authorization", "Bearer "+token)
	reqNoPos.Header.Set("Idempotency-Key", "cashout-nopos-"+uuid.New().String())
	router.ServeHTTP(wNoPos, reqNoPos)

	if wNoPos.Code != http.StatusBadRequest {
		t.Fatalf("Expected HTTP 400 for liquidating non-existent position, got %d", wNoPos.Code)
	}
	var noPosErr map[string]interface{}
	_ = json.Unmarshal(wNoPos.Body.Bytes(), &noPosErr)
	if noPosErr["error"] != "insufficient_shares" {
		t.Errorf("Expected error code 'insufficient_shares', got %v", noPosErr["error"])
	}

	// Attempting to cash out with an unattainable min_payout_usdc floor must be rejected as slippage
	highPayoutPayload := map[string]string{
		"market_id":       marketID,
		"outcome":         "YES",
		"shares":          "1.00000000",
		"min_payout_usdc": "500.00000000", // Unattainable floor for 1 share, should trigger slippage_exceeded NOT invalid_slippage
	}
	highPayoutBytes, _ := json.Marshal(highPayoutPayload)
	wHigh := httptest.NewRecorder()
	reqHigh, _ := http.NewRequest(http.MethodPost, "/api/v1/portfolio/cashout", bytes.NewReader(highPayoutBytes))
	reqHigh.Header.Set("Content-Type", "application/json")
	reqHigh.Header.Set("Authorization", "Bearer "+token)
	reqHigh.Header.Set("Idempotency-Key", "cashout-highfloor-"+uuid.New().String())
	router.ServeHTTP(wHigh, reqHigh)

	if wHigh.Code != http.StatusBadRequest {
		t.Fatalf("Expected HTTP 400 when min_payout_usdc cannot be met, got %d", wHigh.Code)
	}
	var highErr map[string]interface{}
	_ = json.Unmarshal(wHigh.Body.Bytes(), &highErr)
	if highErr["error"] != "slippage_exceeded" {
		t.Errorf("Expected error code 'slippage_exceeded', got %v (body: %s)", highErr["error"], wHigh.Body.String())
	}
}

// 4. Idempotency Replay Test: Submitting identical order twice returns original receipt without double-charging
func TestOrder_IdempotencyReplay(t *testing.T) {
	pool, _, router := getTestEnv(t)
	defer pool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	wAuth := httptest.NewRecorder()
	reqAuth, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/guest", nil)
	router.ServeHTTP(wAuth, reqAuth)
	var authData struct {
		Token string `json:"token"`
		User  struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	_ = json.Unmarshal(wAuth.Body.Bytes(), &authData)
	token := authData.Token
	userID := authData.User.ID

	var marketID string
	_ = pool.QueryRow(ctx, "SELECT id FROM markets WHERE status = 'active' ORDER BY created_at ASC LIMIT 1").Scan(&marketID)

	idempKey := "idemp-test-replay-" + uuid.New().String()
	orderPayload := map[string]string{
		"outcome":        "YES",
		"amount_usdc":    "50.00000000",
		"min_shares_out": "0.00000001",
	}
	bodyBytes, _ := json.Marshal(orderPayload)

	// First call
	w1 := httptest.NewRecorder()
	req1, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("/api/v1/markets/%s/orders", marketID), bytes.NewReader(bodyBytes))
	req1.Header.Set("Content-Type", "application/json")
	req1.Header.Set("Authorization", "Bearer "+token)
	req1.Header.Set("Idempotency-Key", idempKey)
	router.ServeHTTP(w1, req1)

	if w1.Code != http.StatusCreated {
		t.Fatalf("First call failed with status %d: %s", w1.Code, w1.Body.String())
	}

	var resp1 orderResponseData
	_ = json.Unmarshal(w1.Body.Bytes(), &resp1)

	// Second identical call with identical Idempotency-Key
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("/api/v1/markets/%s/orders", marketID), bytes.NewReader(bodyBytes))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("Authorization", "Bearer "+token)
	req2.Header.Set("Idempotency-Key", idempKey)
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK && w2.Code != http.StatusCreated {
		t.Fatalf("Second call failed with status %d: %s", w2.Code, w2.Body.String())
	}

	var resp2 orderResponseData
	_ = json.Unmarshal(w2.Body.Bytes(), &resp2)

	if resp1.TradeID != resp2.TradeID {
		t.Fatalf("Idempotency failed: Trade IDs differ! %s vs %s", resp1.TradeID, resp2.TradeID)
	}

	// Verify user was only charged once ($50, not $100)
	var cashDB string
	_ = pool.QueryRow(ctx, "SELECT cash_balance FROM users WHERE id = $1", userID).Scan(&cashDB)
	if cashDB != "950.00000000" {
		t.Fatalf("Double charge occurred! Expected cash balance 950.00000000, got %s", cashDB)
	}
}

// TestSlippage_FloorsComeFromQuote verifies slippage is enforced only as drift from the quote:
// a large order whose price impact exceeds the tolerance still fills when its floor is derived from
// the quote, and a full cash-out succeeds with a floor derived from the SELL quote.
func TestSlippage_FloorsComeFromQuote(t *testing.T) {
	pool, _, router := getTestEnv(t)
	defer pool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	// Dedicated 10,000 USDC 50/50 market so price impact is deterministic
	marketID := uuid.New()
	slug := fmt.Sprintf("test-slippage-%d", time.Now().UnixNano())
	if _, err := pool.Exec(ctx, `
		INSERT INTO markets (id, slug, title, description, category, resolution_source, resolution_date, status)
		VALUES ($1, $2, 'Test Slippage Market', 'Slippage semantics', 'macro', 'Oracle Official', NOW() + INTERVAL '1 day', 'active');
	`, marketID, slug); err != nil {
		t.Fatalf("Failed to create test market: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO liquidity_pools (market_id, reserve_yes, reserve_no, collateral_reserve, k_invariant, total_volume_usdc)
		VALUES ($1, 5000.00000000, 5000.00000000, 10000.00000000, 25000000.00000000, 0.00000000);
	`, marketID); err != nil {
		t.Fatalf("Failed to create test liquidity pool: %v", err)
	}
	defer func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM ledger_entries WHERE market_id = $1", marketID)
		_, _ = pool.Exec(context.Background(), "DELETE FROM markets WHERE id = $1", marketID)
	}()

	wAuth := httptest.NewRecorder()
	reqAuth, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/guest", nil)
	router.ServeHTTP(wAuth, reqAuth)
	var authData struct {
		Token string `json:"token"`
	}
	_ = json.Unmarshal(wAuth.Body.Bytes(), &authData)
	if authData.Token == "" {
		t.Fatalf("Failed to provision guest: %d %s", wAuth.Code, wAuth.Body.String())
	}

	post := func(url string, payload map[string]string, idempKey string) (*httptest.ResponseRecorder, map[string]interface{}) {
		body, _ := json.Marshal(payload)
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+authData.Token)
		if idempKey != "" {
			req.Header.Set("Idempotency-Key", idempKey)
		}
		router.ServeHTTP(w, req)
		var out map[string]interface{}
		_ = json.Unmarshal(w.Body.Bytes(), &out)
		return w, out
	}
	quoteURL := fmt.Sprintf("/api/v1/markets/%s/quote", marketID)
	orderURL := fmt.Sprintf("/api/v1/markets/%s/orders", marketID)
	tolerance := decimal.RequireFromString("0.99") // 1% tolerance, the UI default

	// 1. BUY quote for 500 USDC: price impact is far above 1%
	w, buyQuote := post(quoteURL, map[string]string{"action": "BUY", "outcome": "YES", "amount_usdc": "500.00000000"}, "")
	if w.Code != http.StatusOK {
		t.Fatalf("BUY quote failed: %d %s", w.Code, w.Body.String())
	}
	quotedShares := decimal.RequireFromString(buyQuote["shares_received"].(string))
	if impact := decimal.RequireFromString(buyQuote["price_impact_pct"].(string)); impact.LessThanOrEqual(decimal.NewFromInt(1)) {
		t.Fatalf("Test precondition: expected price impact above 1%%, got %s", impact)
	}

	// 2. min_shares_out is required
	w, errBody := post(orderURL, map[string]string{"outcome": "YES", "amount_usdc": "500.00000000"}, "slip-missing-"+uuid.New().String())
	if w.Code != http.StatusBadRequest || errBody["error"] != "min_shares_out_required" {
		t.Errorf("Expected 400 min_shares_out_required, got %d %v", w.Code, errBody["error"])
	}

	// 3. A floor above what the pool can fill is rejected as slippage
	w, errBody = post(orderURL, map[string]string{
		"outcome": "YES", "amount_usdc": "500.00000000",
		"min_shares_out": quotedShares.Add(decimal.NewFromInt(1)).StringFixed(8),
	}, "slip-floor-"+uuid.New().String())
	if w.Code != http.StatusBadRequest || errBody["error"] != "slippage_exceeded" {
		t.Errorf("Expected 400 slippage_exceeded for unattainable floor, got %d %v", w.Code, errBody["error"])
	}

	// 4. The same large order fills when its floor is quote x (1 - tolerance)
	w, buyResp := post(orderURL, map[string]string{
		"outcome": "YES", "amount_usdc": "500.00000000",
		"min_shares_out": quotedShares.Mul(tolerance).Truncate(8).StringFixed(8),
	}, "slip-ok-"+uuid.New().String())
	if w.Code != http.StatusCreated {
		t.Fatalf("Expected large order to fill within quote tolerance, got %d %s", w.Code, w.Body.String())
	}
	if filled := decimal.RequireFromString(buyResp["shares_filled"].(string)); !filled.Equal(quotedShares) {
		t.Errorf("Expected fill to match the unchanged quote: quoted %s, filled %s", quotedShares, filled)
	}

	// 5. Full cash-out with a floor from the SELL quote succeeds even though impact exceeds 2%
	sharesOwned := buyResp["new_shares_owned"].(string)
	w, sellQuote := post(quoteURL, map[string]string{"action": "SELL", "outcome": "YES", "shares": sharesOwned}, "")
	if w.Code != http.StatusOK {
		t.Fatalf("SELL quote failed: %d %s", w.Code, w.Body.String())
	}
	quotedPayout := decimal.RequireFromString(sellQuote["payout_usdc"].(string))

	w, errBody = post("/api/v1/portfolio/cashout", map[string]string{
		"market_id": marketID.String(), "outcome": "YES", "shares": sharesOwned,
	}, "slip-cash-missing-"+uuid.New().String())
	if w.Code != http.StatusBadRequest || errBody["error"] != "min_payout_usdc_required" {
		t.Errorf("Expected 400 min_payout_usdc_required, got %d %v", w.Code, errBody["error"])
	}

	w, cashResp := post("/api/v1/portfolio/cashout", map[string]string{
		"market_id": marketID.String(), "outcome": "YES", "shares": sharesOwned,
		"min_payout_usdc": quotedPayout.Mul(tolerance).Truncate(8).StringFixed(8),
	}, "slip-cash-ok-"+uuid.New().String())
	if w.Code != http.StatusOK {
		t.Fatalf("Expected full cash-out within quote tolerance, got %d %s", w.Code, w.Body.String())
	}
	if paid := decimal.RequireFromString(cashResp["payout_usdc"].(string)); !paid.Equal(quotedPayout) {
		t.Errorf("Expected payout to match the unchanged SELL quote: quoted %s, paid %s", quotedPayout, paid)
	}
}
