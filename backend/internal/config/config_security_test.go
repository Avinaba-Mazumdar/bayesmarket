package config_test

import (
	"strings"
	"testing"

	"github.com/Avinaba-Mazumdar/bayesmarket/internal/config"
)

const testJWTSecret = "this-is-a-valid-test-jwt-secret-of-32-bytes-plus"

func TestLoad_RequiresJWTSecretInEveryEnvironment(t *testing.T) {
	for _, env := range []string{"local", "dev", "production"} {
		t.Run(env, func(t *testing.T) {
			t.Setenv("APP_ENV", env)
			t.Setenv("JWT_SECRET", "")
			if _, err := config.Load(); err == nil || !strings.Contains(err.Error(), "JWT_SECRET") {
				t.Fatalf("expected JWT_SECRET to be required in %s, got %v", env, err)
			}
		})
	}
}

func TestLoad_RejectsShortJWTSecret(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("JWT_SECRET", "too-short")
	if _, err := config.Load(); err == nil {
		t.Fatal("expected a short JWT_SECRET to be rejected")
	}
}

func TestLoad_DevModeRefusesNonLocalDatabase(t *testing.T) {
	t.Setenv("APP_ENV", "dev")
	t.Setenv("JWT_SECRET", testJWTSecret)
	t.Setenv("DATABASE_URL", "postgres://app:secret@ep-cool-pool.us-east-2.aws.neon.tech/bayes?sslmode=require")
	if _, err := config.Load(); err == nil || !strings.Contains(err.Error(), "non-local") {
		t.Fatalf("expected dev mode to refuse a non-local database host, got %v", err)
	}
}

func TestLoad_DevModeAcceptsLocalDatabase(t *testing.T) {
	for _, dsn := range []string{
		"postgres://app:secret@localhost:5432/bayes?sslmode=disable",
		"postgres://app:secret@127.0.0.1:5432/bayes?sslmode=disable",
		"postgres://app:secret@postgres:5432/bayes?sslmode=disable",
	} {
		t.Setenv("APP_ENV", "local")
		t.Setenv("JWT_SECRET", testJWTSecret)
		t.Setenv("DATABASE_URL", dsn)
		if _, err := config.Load(); err != nil {
			t.Errorf("%s should be accepted in local mode: %v", dsn, err)
		}
	}
}

func TestProductionAllowsAnyDatabaseHost(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("JWT_SECRET", testJWTSecret)
	t.Setenv("DATABASE_URL", "postgres://app:secret@db.example.com:5432/bayes?sslmode=require")
	if _, err := config.Load(); err != nil {
		t.Fatalf("production must not apply the local-host rule: %v", err)
	}
}

// The ephemeral secret used when no configuration is supplied must be random, never the old public constant.
func TestEphemeralJWTSecretIsRandom(t *testing.T) {
	a, b := config.EphemeralJWTSecret(), config.EphemeralJWTSecret()
	if len(a) < 32 || a == b {
		t.Fatalf("ephemeral secrets must be at least 32 characters and unique (got %d, equal=%v)", len(a), a == b)
	}
	if strings.Contains(a, "bayesmarket-development") {
		t.Fatal("ephemeral secret must not contain the old public default")
	}
}
