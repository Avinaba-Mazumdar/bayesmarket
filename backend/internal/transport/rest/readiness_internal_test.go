package rest

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Avinaba-Mazumdar/bayesmarket/internal/config"
)

// While the database connects, /api answers 503 with Retry-After and /healthz reports "starting" with 200.
// Once the gate opens, /api is served normally.
func TestReadinessGate(t *testing.T) {
	readiness := NewReadiness()
	router := SetupRouterWithReadiness(nil, &config.Config{JWTSecret: "bayesmarket-development-hmac-sha256-default-secret-key-32b", Environment: "test", DisableRateLimits: true}, nil, readiness)

	get := func(path string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, path, nil)
		router.ServeHTTP(w, req)
		return w
	}

	w := get("/api/v1/categories")
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("before ready: GET /api/v1/categories = %d, want 503", w.Code)
	}
	if w.Header().Get("Retry-After") == "" {
		t.Error("before ready: 503 should carry Retry-After")
	}

	w = get("/healthz")
	if w.Code != http.StatusOK {
		t.Fatalf("before ready: GET /healthz = %d, want 200", w.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode /healthz: %v", err)
	}
	if body["status"] != "starting" {
		t.Errorf("before ready: /healthz status = %q, want starting", body["status"])
	}

	readiness.MarkReady()
	if w := get("/api/v1/categories"); w.Code != http.StatusOK {
		t.Fatalf("after ready: GET /api/v1/categories = %d, want 200", w.Code)
	}
}

// A router built without a gate never answers 503 for warming up.
func TestNilReadinessNeverGates(t *testing.T) {
	var r *Readiness
	if !r.Ready() {
		t.Fatal("a nil Readiness should report ready")
	}
}
