package rest

import (
	"strings"
	"testing"
)

func TestParseMarketProbabilityAcceptsOnlyFractions(t *testing.T) {
	for _, ok := range []string{"0.01", "0.5", " 0.37 ", "0.99", "0.12345678"} {
		if _, err := parseMarketProbability(ok, "p"); err != nil {
			t.Errorf("%q: unexpected error %v", ok, err)
		}
	}
	// "50" and "1.5" used to be read as percentages; they are now rejected instead of guessed.
	for _, bad := range []string{"50", "1.5", "1", "0", "0.001", "0.995", "0.123456789", "abc", ""} {
		if _, err := parseMarketProbability(bad, "p"); err == nil {
			t.Errorf("%q: expected rejection", bad)
		}
	}
}

func TestValidateMarketTextEnforcesColumnLimits(t *testing.T) {
	if err := validateMarketText("Title", "Desc", "macro", "Source"); err != nil {
		t.Fatalf("valid text rejected: %v", err)
	}
	// Limits are in characters, matching VARCHAR(n): 255 multi-byte runes fit, 256 do not.
	if err := validateMarketText(strings.Repeat("é", maxMarketTitleLen), "d", "c", "s"); err != nil {
		t.Errorf("255-character title rejected: %v", err)
	}
	cases := map[string][4]string{
		"invalid_title":             {strings.Repeat("a", maxMarketTitleLen+1), "d", "c", "s"},
		"invalid_category":          {"t", "d", strings.Repeat("c", maxMarketCategoryLen+1), "s"},
		"invalid_description":       {"t", strings.Repeat("d", maxMarketDescriptionLen+1), "c", "s"},
		"invalid_resolution_source": {"t", "d", "c", strings.Repeat("s", maxMarketSourceLen+1)},
	}
	for code, f := range cases {
		err := validateMarketText(f[0], f[1], f[2], f[3])
		if err == nil || err.ErrorCode != code {
			t.Errorf("expected %s, got %v", code, err)
		}
	}
}
