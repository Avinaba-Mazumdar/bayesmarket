package rest

import (
	"context"
	"testing"
	"time"
)

func TestMarketLock_CancelledWaitDoesNotBlockTheNextBuyer(t *testing.T) {
	locks := newMarketLockRegistry()
	ctx := context.Background()

	unlock, err := locks.acquire(ctx, "market:test")
	if err != nil {
		t.Fatal(err)
	}

	cancelled, cancel := context.WithCancel(context.Background())
	cancel()
	done := make(chan struct{})
	go func() {
		defer close(done)
		if _, err := locks.acquire(cancelled, "market:test"); err == nil {
			t.Error("expected the cancelled wait to fail")
		}
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("cancelled acquire waited on the held lock")
	}

	unlock()

	next, err := locks.acquire(ctx, "market:test")
	if err != nil {
		t.Fatal(err)
	}
	next()
}

func TestMarketLock_SecondCallerWaitsUntilUnlock(t *testing.T) {
	locks := newMarketLockRegistry()
	ctx := context.Background()

	first, err := locks.acquire(ctx, "market:queue")
	if err != nil {
		t.Fatal(err)
	}

	got := make(chan struct{})
	go func() {
		unlock, err := locks.acquire(ctx, "market:queue")
		if err != nil {
			t.Error(err)
			return
		}
		close(got)
		unlock()
	}()

	select {
	case <-got:
		t.Fatal("second acquire took the lock while the first still held it")
	case <-time.After(50 * time.Millisecond):
	}

	first()

	select {
	case <-got:
	case <-time.After(2 * time.Second):
		t.Fatal("second acquire did not proceed after unlock")
	}
}
