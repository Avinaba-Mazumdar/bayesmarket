package rest

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type countingPinger struct {
	calls atomic.Int32
	err   error
}

func (p *countingPinger) Ping(ctx context.Context) error {
	p.calls.Add(1)
	// Hold the probe briefly so concurrent callers overlap with it.
	time.Sleep(5 * time.Millisecond)
	return p.err
}

func TestHealthProbe_ReusesPingWithinTTL(t *testing.T) {
	pinger := &countingPinger{}
	probe := &healthProbe{db: pinger, ttl: time.Minute}

	for i := 0; i < 100; i++ {
		if got := probe.database(); got != "connected" {
			t.Fatalf("database() = %q; want connected", got)
		}
	}
	if calls := pinger.calls.Load(); calls != 1 {
		t.Fatalf("100 health checks within the TTL ran %d pings; want 1", calls)
	}
}

func TestHealthProbe_PingsAgainAfterTTL(t *testing.T) {
	pinger := &countingPinger{}
	probe := &healthProbe{db: pinger, ttl: 10 * time.Millisecond}

	probe.database()
	time.Sleep(20 * time.Millisecond)
	probe.database()

	if calls := pinger.calls.Load(); calls != 2 {
		t.Fatalf("pings after the TTL expired = %d; want 2", calls)
	}
}

func TestHealthProbe_ConcurrentCallersShareOnePing(t *testing.T) {
	pinger := &countingPinger{}
	probe := &healthProbe{db: pinger, ttl: time.Minute}

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			probe.database()
		}()
	}
	wg.Wait()

	if calls := pinger.calls.Load(); calls != 1 {
		t.Fatalf("50 concurrent health checks ran %d pings; want 1", calls)
	}
}

func TestHealthProbe_ReportsDegradedWhenPingFails(t *testing.T) {
	probe := &healthProbe{db: &countingPinger{err: errors.New("connection refused")}, ttl: time.Minute}
	if got := probe.database(); got != "degraded" {
		t.Fatalf("database() after a failed ping = %q; want degraded", got)
	}
}

func TestHealthProbe_NilPoolIsDisconnected(t *testing.T) {
	probe := newHealthProbe(nil, time.Minute)
	if got := probe.database(); got != "disconnected" {
		t.Fatalf("database() with no pool = %q; want disconnected", got)
	}
}
