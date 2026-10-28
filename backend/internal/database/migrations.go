package database

import (
	"context"
	"embed"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// migrationLockKey is the pg_advisory_lock key that serializes migration runs across instances.
const migrationLockKey int64 = 0x42415945534D4B54 // "BAYESMKT"

// RunMigrations executes any unapplied SQL migrations sequentially inside transactions.
//
// It holds a session-level advisory lock for the whole run, so instances booting at the same time
// apply each migration exactly once: the second instance waits, then finds everything applied.
//
// History notes (applied in production; do not renumber or edit):
//   - Version 000004 does not exist. Versions are applied in sorted order, so the gap is harmless.
//   - 000005.down recreates the retired is_superadmin column; rolling back past 000005 restores the
//     pre-000005 schema, which the current code no longer uses.
func RunMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	// The advisory lock belongs to a session, so every statement below runs on this one connection.
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("failed to acquire migration connection: %w", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, "SELECT pg_advisory_lock($1)", migrationLockKey); err != nil {
		return fmt.Errorf("failed to take migration lock: %w", err)
	}
	defer func() {
		// Use a fresh context so the lock is released even if ctx was cancelled mid-run.
		unlockCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if _, err := conn.Exec(unlockCtx, "SELECT pg_advisory_unlock($1)", migrationLockKey); err != nil {
			log.Printf("[WARN] Failed to release migration lock: %v\n", err)
		}
	}()

	// Ensure migration tracking table exists
	createTableSQL := `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version BIGINT PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		);
	`
	if _, err := conn.Exec(ctx, createTableSQL); err != nil {
		return fmt.Errorf("failed to create schema_migrations table: %w", err)
	}

	// Read all embedded migration files
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("failed to read embedded migrations: %w", err)
	}

	var upFiles []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".up.sql") {
			upFiles = append(upFiles, entry.Name())
		}
	}
	sort.Strings(upFiles)

	for _, fileName := range upFiles {
		var version int64
		_, err := fmt.Sscanf(fileName, "%06d", &version)
		if err != nil {
			log.Printf("[WARN] Skipping non-standard migration filename: %s\n", fileName)
			continue
		}

		// Check if already applied
		var exists bool
		err = conn.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)", version).Scan(&exists)
		if err != nil {
			return fmt.Errorf("failed to check migration status for %s: %w", fileName, err)
		}

		if exists {
			continue
		}

		log.Printf("[INFO] Applying migration: %s (version %d)...\n", fileName, version)
		content, err := migrationsFS.ReadFile("migrations/" + fileName)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", fileName, err)
		}

		tx, err := conn.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
		if err != nil {
			return fmt.Errorf("failed to begin transaction for migration %s: %w", fileName, err)
		}

		if _, err := tx.Exec(ctx, string(content)); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("failed to execute migration %s: %w", fileName, err)
		}

		insertSQL := "INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, $3)"
		if _, err := tx.Exec(ctx, insertSQL, version, fileName, time.Now().UTC()); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("failed to record migration %s: %w", fileName, err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("failed to commit migration %s: %w", fileName, err)
		}

		log.Printf("[INFO] Migration %s successfully applied.\n", fileName)
	}

	return nil
}
