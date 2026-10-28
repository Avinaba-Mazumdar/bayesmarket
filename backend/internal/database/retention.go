package database

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// StartRetention redacts IP addresses and deletes expired session and idempotency rows.
// DELETE needs a role that is allowed to delete. A permission error is logged once per statement
// and the loop keeps running so IP redaction, which is an UPDATE, still happens.
func StartRetention(ctx context.Context, pool *pgxpool.Pool) {
	if pool == nil {
		return
	}
	go func() {
		// The first pass waits a minute so it does not compete with the first requests after a cold start.
		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Minute):
		}
		runRetention(ctx, pool)
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				runRetention(ctx, pool)
			}
		}
	}()
}

func runRetention(ctx context.Context, pool *pgxpool.Pool) {
	cctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	statements := []string{
		`UPDATE faucet_claims SET ip_address = 'redacted'
		 WHERE claimed_at < NOW() - INTERVAL '30 days' AND ip_address <> 'redacted'`,
		`UPDATE users SET ip_address = NULL
		 WHERE ip_address IS NOT NULL AND last_active < NOW() - INTERVAL '30 days'`,
		`DELETE FROM refresh_tokens
		 WHERE expires_at < NOW() - INTERVAL '7 days'
		    OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days')`,
		`DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '7 days'`,
	}
	for _, stmt := range statements {
		if _, err := pool.Exec(cctx, stmt); err != nil && !errors.Is(err, context.Canceled) {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "42501" {
				log.Printf("[WARN] retention skipped a delete the database role cannot run: %s", pgErr.Message)
				continue
			}
			log.Printf("[WARN] retention statement failed: %v", err)
		}
	}
}
