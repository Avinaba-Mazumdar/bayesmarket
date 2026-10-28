package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NewPool initializes a high-performance pgx connection pool optimized for Neon Serverless PostgreSQL
// and waits until the database answers.
func NewPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	pool, err := OpenPool(databaseURL)
	if err != nil {
		return nil, err
	}
	if err := WaitReady(ctx, pool); err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}

// OpenPool builds the pool without waiting for the database. pgx dials the MinConns connections in the
// background, so a cold start begins waking Neon at once while the server opens its port.
func OpenPool(databaseURL string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Neon database URL: %w", err)
	}

	// Serverless Neon pool sizing & lifecycle defaults
	config.MaxConns = 30
	config.MinConns = 2
	config.MaxConnLifetime = 1 * time.Hour
	config.MaxConnIdleTime = 15 * time.Minute
	config.HealthCheckPeriod = 1 * time.Minute

	// The background dialing of MinConns runs on this context, so it must outlive the call.
	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		return nil, fmt.Errorf("failed to create pgxpool connection to Neon: %w", err)
	}
	return pool, nil
}

// WaitReady pings until the database answers, allowing time for a suspended Neon compute to wake.
func WaitReady(ctx context.Context, pool *pgxpool.Pool) error {
	var pingErr error
	for attempt := 1; attempt <= 3; attempt++ {
		pingCtx, pingCancel := context.WithTimeout(ctx, 20*time.Second)
		pingErr = pool.Ping(pingCtx)
		pingCancel()
		if pingErr == nil {
			log.Println("[INFO] Successfully established pgx connection pool with Neon Serverless PostgreSQL")
			return nil
		}
		if attempt < 3 {
			log.Printf("[WARN] Neon ping attempt %d/3 failed: %v. Retrying in 2s...", attempt, pingErr)
			select {
			case <-ctx.Done():
				return fmt.Errorf("failed to ping Neon database: %w", ctx.Err())
			case <-time.After(2 * time.Second):
			}
		}
	}
	return fmt.Errorf("failed to ping Neon database after retries: %w", pingErr)
}
