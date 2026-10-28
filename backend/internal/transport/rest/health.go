package rest

import (
	"context"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// healthPinger is the part of the database pool the health probe needs. It exists so the probe can be
// tested without a database.
type healthPinger interface {
	Ping(ctx context.Context) error
}

// healthProbe reports database reachability for /healthz. The endpoint is unauthenticated and unlimited,
// because load balancers and uptime checks call it. Without a cache, an anonymous flood would become one
// database round-trip per request.
type healthProbe struct {
	db     healthPinger
	ttl    time.Duration
	mu     sync.Mutex
	at     time.Time
	status string
}

// newHealthProbe builds a probe that reuses one ping result for ttl. A nil pool reports "disconnected".
func newHealthProbe(pool *pgxpool.Pool, ttl time.Duration) *healthProbe {
	p := &healthProbe{ttl: ttl}
	// Assign only a non-nil pool: a typed nil stored in the interface would not compare equal to nil.
	if pool != nil {
		p.db = pool
	}
	return p
}

// database returns "connected", "degraded" or "disconnected". At most one ping runs per ttl. Callers that
// arrive while a ping is running wait for it and then read its result, so they never start their own.
func (p *healthProbe) database() string {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.db == nil {
		return "disconnected"
	}
	if !p.at.IsZero() && time.Since(p.at) < p.ttl {
		return p.status
	}

	// The ping is bounded so a stalled database cannot hold the lock, and every waiting caller, indefinitely.
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	p.status = "degraded"
	if err := p.db.Ping(ctx); err == nil {
		p.status = "connected"
	}
	p.at = time.Now()
	return p.status
}
