package rest

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bayesmarket/bayesmarket/internal/config"
)

func TestValidateMarketCategory(t *testing.T) {
	for _, ok := range []string{"ai", "crypto", "macro", "science"} {
		if err := validateMarketCategory(ok); err != nil {
			t.Errorf("%q should be accepted: %v", ok, err)
		}
	}
	for _, bad := range []string{"space", "", "AI"} {
		if err := validateMarketCategory(bad); err == nil || err.ErrorCode != "invalid_category" {
			t.Errorf("%q should be rejected with invalid_category", bad)
		}
	}
}

// A relative image path used to be stored and rendered as a broken image. Only https links are allowed now.
func TestValidateMarketImageURL(t *testing.T) {
	for _, ok := range []string{"", "https://cdn.example.com/banner.webp"} {
		if err := validateMarketImageURL(ok); err != nil {
			t.Errorf("%q should be accepted: %v", ok, err)
		}
	}
	for _, bad := range []string{"/assets/markets/macro.webp", "http://example.com/a.png", "javascript:alert(1)", "https://exa mple.com/x.png", "https://"} {
		if err := validateMarketImageURL(bad); err == nil || err.ErrorCode != "invalid_image_url" {
			t.Errorf("%q should be rejected with invalid_image_url", bad)
		}
	}
}

// The public list is the same list validation uses, so the admin form can only offer valid choices.
func TestCategoriesEndpointMatchesValidation(t *testing.T) {
	router := SetupRouter(nil, &config.Config{JWTSecret: "bayesmarket-development-hmac-sha256-default-secret-key-32b", Environment: "test", DisableRateLimits: true})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/categories", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("GET /api/v1/categories: %d", w.Code)
	}
	var list []MarketCategory
	if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(list) != len(marketCategories) {
		t.Fatalf("expected %d categories, got %d", len(marketCategories), len(list))
	}
	for _, c := range list {
		if validateMarketCategory(c.ID) != nil {
			t.Errorf("listed category %q fails validation", c.ID)
		}
	}
}
