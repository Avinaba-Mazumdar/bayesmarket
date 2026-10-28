package rest

import (
	"strings"
	"testing"

	"github.com/bayesmarket/bayesmarket/internal/amm"
	"github.com/shopspring/decimal"
)

func TestValidateIdempotencyKey(t *testing.T) {
	for _, ok := range []string{"a", "order-ui-1730000000000-abc123", strings.Repeat("k", 128), "resolve_2026.09~x"} {
		if err := validateIdempotencyKey(ok); err != nil {
			t.Errorf("%q should be accepted: %v", ok, err)
		}
	}
	for _, bad := range []string{"", strings.Repeat("k", 129), "has space", "tab\tkey", "ünïcode", "line\nbreak"} {
		if err := validateIdempotencyKey(bad); err == nil || err.ErrorCode != "invalid_idempotency_key" {
			t.Errorf("%q should be rejected with invalid_idempotency_key", bad)
		}
	}
}

// A key reused for a different order must not match the stored receipt's fingerprint (S4b).
func TestOrderFingerprintBindsEveryField(t *testing.T) {
	base := orderFingerprint("market-1", amm.OutcomeYES, decimal.NewFromInt(100), decimal.NewFromInt(90))
	if base != orderFingerprint("market-1", amm.OutcomeYES, decimal.NewFromInt(100), decimal.NewFromInt(90)) {
		t.Fatal("fingerprint must be deterministic")
	}
	variants := map[string]string{
		"amount":  orderFingerprint("market-1", amm.OutcomeYES, decimal.NewFromInt(101), decimal.NewFromInt(90)),
		"outcome": orderFingerprint("market-1", amm.OutcomeNO, decimal.NewFromInt(100), decimal.NewFromInt(90)),
		"market":  orderFingerprint("market-2", amm.OutcomeYES, decimal.NewFromInt(100), decimal.NewFromInt(90)),
		"floor":   orderFingerprint("market-1", amm.OutcomeYES, decimal.NewFromInt(100), decimal.NewFromInt(91)),
	}
	for field, fp := range variants {
		if fp == base {
			t.Errorf("changing %s must change the fingerprint", field)
		}
	}
}

// A BUY and a SELL must never share a fingerprint, so a reused key cannot replay one as the other.
func TestBuyAndSellFingerprintsDiffer(t *testing.T) {
	buy := orderFingerprint("m", amm.OutcomeYES, decimal.NewFromInt(10), decimal.NewFromInt(1))
	sell := cashOutFingerprint("m", amm.OutcomeYES, decimal.NewFromInt(10), decimal.NewFromInt(1))
	if buy == sell {
		t.Fatal("buy and sell fingerprints must differ")
	}
}
