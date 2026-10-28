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
)

// TestOrder_IdempotencyKeyReusedWithDifferentBody verifies that a key bound to one order is refused
// when it is reused for a different order, and that the refused request is not charged.
func TestOrder_IdempotencyKeyReusedWithDifferentBody(t *testing.T) {
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
	if err := json.Unmarshal(wAuth.Body.Bytes(), &authData); err != nil || authData.Token == "" {
		t.Fatalf("Guest sign-in failed: %v. Body: %s", err, wAuth.Body.String())
	}
	token := authData.Token
	userID := authData.User.ID

	var marketID string
	if err := pool.QueryRow(ctx, "SELECT id FROM markets WHERE status = 'active' ORDER BY created_at ASC LIMIT 1").Scan(&marketID); err != nil {
		t.Fatalf("No active market to trade in: %v", err)
	}

	idempKey := "idemp-test-binding-" + uuid.New().String()
	place := func(amount string) *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]string{
			"outcome":        "YES",
			"amount_usdc":    amount,
			"min_shares_out": "0.00000001",
		})
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("/api/v1/markets/%s/orders", marketID), bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Idempotency-Key", idempKey)
		router.ServeHTTP(w, req)
		return w
	}

	first := place("50.00000000")
	if first.Code != http.StatusCreated {
		t.Fatalf("First order failed with status %d: %s", first.Code, first.Body.String())
	}

	second := place("60.00000000")
	if second.Code != http.StatusUnprocessableEntity {
		t.Fatalf("Reused key with a different amount: expected 422, got %d: %s", second.Code, second.Body.String())
	}
	var refusal struct {
		Error string `json:"error"`
	}
	if err := json.Unmarshal(second.Body.Bytes(), &refusal); err != nil || refusal.Error != "idempotency_key_reused" {
		t.Fatalf("Expected error idempotency_key_reused, got %q (err %v)", refusal.Error, err)
	}

	var cash string
	if err := pool.QueryRow(ctx, "SELECT cash_balance FROM users WHERE id = $1", userID).Scan(&cash); err != nil {
		t.Fatalf("Failed to read balance: %v", err)
	}
	if cash != "950.00000000" {
		t.Fatalf("Refused request was charged: expected cash 950.00000000, got %s", cash)
	}
}
