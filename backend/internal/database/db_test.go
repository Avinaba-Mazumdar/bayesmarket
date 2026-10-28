package database_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/Avinaba-Mazumdar/bayesmarket/internal/database"
	"github.com/Avinaba-Mazumdar/bayesmarket/internal/testutil"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
)

func getTestPool(t *testing.T) *pgxpool.Pool {
	dbURL := testutil.SafeTestDatabaseURL(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := database.NewPool(ctx, dbURL)
	if err != nil {
		t.Skipf("Skipping live database test: cannot connect to test database: %v", err)
	}

	return pool
}

func TestSchemaConstraints_NegativeUserBalance(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Attempt inserting a user with a negative balance (-50.00 USDC)
	query := `INSERT INTO users (cash_balance) VALUES ($1);`
	_, err := pool.Exec(ctx, query, decimal.NewFromFloat(-50.00))

	if err == nil {
		t.Fatal("Expected check constraint violation 'chk_positive_balance', but insert succeeded")
	}

	if !strings.Contains(err.Error(), "chk_positive_balance") {
		t.Fatalf("Expected error to mention 'chk_positive_balance', got: %v", err)
	}
}

func TestSchemaConstraints_ZeroOrNegativeReserves(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// First insert a test market
	marketID := uuid.New()
	testSlug := "test-market-" + marketID.String()[:8]
	_, err := pool.Exec(ctx, `
		INSERT INTO markets (id, slug, title, description, category, resolution_source, resolution_date)
		VALUES ($1, $2, 'Test', 'Test Desc', 'crypto', 'Source', NOW() + INTERVAL '1 day')
	`, marketID, testSlug)
	if err != nil {
		t.Fatalf("Failed to insert test market: %v", err)
	}

	// Clean up after test
	defer func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM markets WHERE id = $1", marketID)
	}()

	// Attempt inserting liquidity pool with zero reserve_yes
	_, err = pool.Exec(ctx, `
		INSERT INTO liquidity_pools (market_id, reserve_yes, reserve_no, collateral_reserve, k_invariant)
		VALUES ($1, 0, 1000, 1000, 0)
	`, marketID)

	if err == nil {
		t.Fatal("Expected check constraint violation 'chk_positive_reserves', but insert with reserve_yes=0 succeeded")
	}

	if !strings.Contains(err.Error(), "chk_positive_reserves") {
		t.Fatalf("Expected error to mention 'chk_positive_reserves', got: %v", err)
	}
}

// TestRunMigrations_ConcurrentRunsAreSerialized starts two migration runs at once, as two
// instances booting together would. The advisory lock makes the second wait, so both succeed and
// no migration is applied twice (L15).
func TestRunMigrations_ConcurrentRunsAreSerialized(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	errs := make(chan error, 2)
	for i := 0; i < 2; i++ {
		go func() { errs <- database.RunMigrations(ctx, pool) }()
	}
	for i := 0; i < 2; i++ {
		if err := <-errs; err != nil {
			t.Fatalf("concurrent migration run failed: %v", err)
		}
	}

	var duplicates int
	if err := pool.QueryRow(ctx, "SELECT COUNT(*) - COUNT(DISTINCT version) FROM schema_migrations").Scan(&duplicates); err != nil {
		t.Fatal(err)
	}
	if duplicates != 0 {
		t.Errorf("expected each migration recorded once, found %d duplicates", duplicates)
	}
}
