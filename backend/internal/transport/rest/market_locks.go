package rest

import (
	"context"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
)

// marketLockRegistry implements Tier 1 of the two-tier concurrency architecture
// defined in ARCHITECTURE.md §8.1: an in-process mutex per market that serializes
// order and cash-out execution before requests reach PostgreSQL.
//
// Rationale: under SERIALIZABLE isolation, a transaction that blocks on a row
// lock held by another transaction is aborted with SQLSTATE 40001 when the
// holder commits, forcing the blocked request into a full retry (new snapshot,
// new Neon round-trips). Under heavy same-market contention this creates an
// abort/retry storm. Serializing same-market mutations in-process removes the
// common contention case entirely; Tier 2 (SELECT ... FOR UPDATE row locks)
// still guards against cross-process races.
type marketLockRegistry struct {
	mu    sync.Mutex
	locks map[string]*marketLockEntry
}

type marketLockEntry struct {
	// sem is a buffered token. Holding the token means holding the market lock.
	// A channel select lets a cancelled request stop waiting.
	sem  chan struct{}
	refs int
}

func newMarketLockRegistry() *marketLockRegistry {
	return &marketLockRegistry{locks: make(map[string]*marketLockEntry)}
}

// acquire locks the given market key and returns the unlock function.
// The wait ends when ctx is cancelled, so a slow client cannot hold the lock
// and a queued request cannot wait past its own deadline.
// The registry entry is ref-counted so the map does not grow unbounded.
func (r *marketLockRegistry) acquire(ctx context.Context, key string) (func(), error) {
	if ctx == nil {
		ctx = context.Background()
	}

	r.mu.Lock()
	entry, ok := r.locks[key]
	if !ok {
		entry = &marketLockEntry{sem: make(chan struct{}, 1)}
		entry.sem <- struct{}{}
		r.locks[key] = entry
	}
	entry.refs++
	r.mu.Unlock()

	select {
	case <-entry.sem:
		var once sync.Once
		return func() {
			once.Do(func() {
				entry.sem <- struct{}{}
				r.release(key, entry)
			})
		}, nil
	case <-ctx.Done():
		r.release(key, entry)
		return nil, ctx.Err()
	}
}

// release drops one waiter or holder. The entry is removed only when this
// pointer is still the map value, so a replacement for the same key is kept.
func (r *marketLockRegistry) release(key string, entry *marketLockEntry) {
	r.mu.Lock()
	entry.refs--
	if entry.refs == 0 && r.locks[key] == entry {
		delete(r.locks, key)
	}
	r.mu.Unlock()
}

// lockMarket acquires the in-process market lock or writes a retryable error.
// Call it only after the request body has been read and validated.
func lockMarket(c *gin.Context, locks *marketLockRegistry, ctx context.Context, key string) (func(), bool) {
	unlock, err := locks.acquire(ctx, key)
	if err != nil {
		respondError(c, http.StatusServiceUnavailable, "market_busy", "The market is busy. Retry shortly.")
		return nil, false
	}
	return unlock, true
}
