package rest

import (
	"net/http"
	"sync/atomic"

	"github.com/gin-gonic/gin"
)

// Readiness reports whether the database has answered and migrations have run. The server opens its port
// before that, so on a cold start the platform wake and the database connect overlap instead of adding up.
// A nil *Readiness is always ready.
type Readiness struct {
	ready atomic.Bool
}

// NewReadiness returns a gate that stays closed until MarkReady.
func NewReadiness() *Readiness {
	return &Readiness{}
}

// MarkReady opens the gate. It is safe to call from any goroutine.
func (r *Readiness) MarkReady() {
	r.ready.Store(true)
}

// Ready reports whether requests may reach the database.
func (r *Readiness) Ready() bool {
	return r == nil || r.ready.Load()
}

// readinessMiddleware answers 503 with Retry-After while the server is still connecting. /healthz is exempt:
// it reports "starting" itself, so the platform sees the process as up.
func readinessMiddleware(r *Readiness) gin.HandlerFunc {
	return func(c *gin.Context) {
		if r.Ready() || c.Request.URL.Path == "/healthz" {
			c.Next()
			return
		}
		c.Header("Retry-After", "2")
		respondError(c, http.StatusServiceUnavailable, "warming_up", "The server is starting. Retry in a moment.")
		c.Abort()
	}
}
