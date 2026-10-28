package rest

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Avinaba-Mazumdar/bayesmarket/internal/config"
	"github.com/gin-gonic/gin"
)

// probeClientIP builds the router with cfg and returns the ClientIP the handler sees for a request
// from remoteAddr that carries the given header.
func probeClientIP(t *testing.T, cfg *config.Config, header, value, remoteAddr string) string {
	t.Helper()
	gin.SetMode(gin.TestMode)
	router := SetupRouter(nil, cfg, nil)
	router.GET("/client-ip-probe", func(c *gin.Context) { c.String(http.StatusOK, c.ClientIP()) })

	req := httptest.NewRequest(http.MethodGet, "/client-ip-probe", nil)
	req.RemoteAddr = remoteAddr
	if header != "" {
		req.Header.Set(header, value)
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec.Body.String()
}

func TestClientIP_UsesConfiguredPlatformHeader(t *testing.T) {
	cfg := &config.Config{
		JWTSecret:         strings.Repeat("s", 32),
		Environment:       "test",
		DisableRateLimits: true,
		ClientIPHeader:    "CF-Connecting-IP",
	}
	if got := probeClientIP(t, cfg, "CF-Connecting-IP", "203.0.113.7", "10.0.0.5:4321"); got != "203.0.113.7" {
		t.Fatalf("ClientIP with CF-Connecting-IP configured = %q; want the header value", got)
	}
}

func TestClientIP_IgnoresHeaderWhenNotConfigured(t *testing.T) {
	cfg := &config.Config{
		JWTSecret:         strings.Repeat("s", 32),
		Environment:       "test",
		DisableRateLimits: true,
	}
	// Without a configured platform header and without trusted proxies, a client-supplied header
	// must not change the address the rate limits key on.
	if got := probeClientIP(t, cfg, "CF-Connecting-IP", "203.0.113.7", "10.0.0.5:4321"); got != "10.0.0.5" {
		t.Fatalf("ClientIP without CLIENT_IP_HEADER = %q; want the connection address 10.0.0.5", got)
	}
}
