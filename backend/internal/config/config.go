package config

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log"
	"net/url"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

// localDatabaseHosts are the database hosts accepted while running in local or dev mode. "postgres"
// is the service name used by docker-compose.yml.
var localDatabaseHosts = map[string]bool{
	"localhost": true,
	"127.0.0.1": true,
	"::1":       true,
	"postgres":  true,
}

// EphemeralJWTSecret returns a random secret for this process only. It is used when a caller builds
// handlers without configuration. Tokens signed with it stop verifying after a restart, so this
// never weakens a deployment: there is no public, well-known secret anywhere in the code.
func EphemeralJWTSecret() string {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		panic("config: cannot read random bytes for the ephemeral JWT secret: " + err.Error())
	}
	return base64.RawURLEncoding.EncodeToString(raw)
}

// requireLocalDatabase refuses a non-local database host in local or dev mode. A developer's shell
// that still points at a deployed database would otherwise run with dev-only behaviour against
// production data.
func requireLocalDatabase(env, rawURL string) error {
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("DATABASE_URL is not a valid URL: %w", err)
	}
	if !localDatabaseHosts[u.Hostname()] {
		return fmt.Errorf("APP_ENV=%s refuses a non-local DATABASE_URL host %q; use a local database, or run with APP_ENV=production", env, u.Hostname())
	}
	return nil
}

// Config encapsulates validated runtime configuration settings.
type Config struct {
	DatabaseURL          string
	MigrationDatabaseURL string
	AutoMigrate          bool
	ServerPort           string
	CORSOrigin           string
	JWTSecret            string
	Environment          string
	GoogleClientID       string
	GoogleClientSecret   string
	GoogleRedirectURI    string
	DisableRateLimits    bool
	TrustedProxies       []string
	// CookieSameSite is "lax" or "none". Lax is the default: the refresh cookie is first-party
	// when the frontend proxies /api. "none" is only for a split-origin deploy, and browsers
	// that block third-party cookies will drop the session on reload.
	CookieSameSite string
	// OAuthStateSecret signs the browser-bound OAuth state. It is not the JWT signing key.
	OAuthStateSecret string
}

// Load reads configuration from environment variables and local .env files.
// It searches both current directory and parent dirs for .env.
func Load() (*Config, error) {
	// Attempt to load from potential .env locations (current dir, parent dir, workspace root)
	for _, envPath := range []string{".env", "../.env", "../../.env"} {
		if _, err := os.Stat(envPath); err == nil {
			if loadErr := godotenv.Load(envPath); loadErr != nil {
				log.Printf("[WARN] Failed loading %s: %v", envPath, loadErr)
			} else {
				log.Printf("[INFO] Loaded configuration from %s", envPath)
				break
			}
		}
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Println("[INFO] DATABASE_URL environment variable is not set. Operating in disconnected sandbox mode.")
	}

	migrationDBURL := os.Getenv("MIGRATION_DATABASE_URL")

	autoMigrate := true
	if rawAutoMigrate := os.Getenv("AUTO_MIGRATE"); rawAutoMigrate != "" {
		lower := strings.ToLower(strings.TrimSpace(rawAutoMigrate))
		if lower == "false" || lower == "0" || lower == "no" {
			autoMigrate = false
		}
	}

	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = os.Getenv("PORT")
		if port == "" {
			port = "8080"
		}
	}

	corsOrigin := os.Getenv("CORS_ORIGIN")
	if corsOrigin == "" {
		corsOrigin = "http://localhost:4200"
	}

	env := os.Getenv("APP_ENV")
	if env == "" {
		env = os.Getenv("ENVIRONMENT")
		if env == "" {
			env = "production"
		}
	}
	env = strings.ToLower(strings.TrimSpace(env))
	isDevOrLocal := env == "local" || env == "dev" || env == "development"

	// The secret is required in every environment. There is no built-in default, so a
	// misconfigured host cannot run with a secret that is public in this repository.
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET environment variable is required in every environment (minimum 32 characters)")
	}
	if len(jwtSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET must be at least 32 characters long")
	}

	if isDevOrLocal && dbURL != "" {
		if err := requireLocalDatabase(env, dbURL); err != nil {
			return nil, err
		}
	}

	googleClientID := os.Getenv("GOOGLE_CLIENT_ID")
	googleClientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
	googleRedirectURI := os.Getenv("GOOGLE_REDIRECT_URI")
	if googleRedirectURI == "" {
		googleRedirectURI = "http://localhost:4200/auth/callback"
	}

	var trustedProxies []string
	if rawProxies := os.Getenv("TRUSTED_PROXIES"); rawProxies != "" {
		for _, p := range strings.Split(rawProxies, ",") {
			if trimmed := strings.TrimSpace(p); trimmed != "" {
				trustedProxies = append(trustedProxies, trimmed)
			}
		}
	}
	if !isDevOrLocal && len(trustedProxies) == 0 {
		log.Println("[WARN] TRUSTED_PROXIES is empty. X-Forwarded-For is ignored and the client IP is the direct connection. Set TRUSTED_PROXIES to the reverse-proxy CIDRs when the API sits behind one.")
	}

	cookieSameSite := strings.ToLower(strings.TrimSpace(os.Getenv("COOKIE_SAMESITE")))
	if cookieSameSite == "" {
		cookieSameSite = "lax"
	}
	if cookieSameSite != "lax" && cookieSameSite != "none" {
		return nil, fmt.Errorf("COOKIE_SAMESITE must be lax or none")
	}
	if cookieSameSite == "none" && !isDevOrLocal {
		log.Println("[WARN] COOKIE_SAMESITE=none sends the refresh cookie cross-site. Browsers that block third-party cookies will sign the reader out on reload. Proxy /api on the frontend origin and use lax instead.")
	}

	oauthStateSecret := strings.TrimSpace(os.Getenv("OAUTH_STATE_SECRET"))
	if oauthStateSecret == "" {
		oauthStateSecret = deriveOAuthStateSecret(jwtSecret)
	} else if len(oauthStateSecret) < 32 {
		return nil, fmt.Errorf("OAUTH_STATE_SECRET must be at least 32 characters when it is set")
	}

	return &Config{
		DatabaseURL:          strings.TrimSpace(dbURL),
		MigrationDatabaseURL: strings.TrimSpace(migrationDBURL),
		AutoMigrate:          autoMigrate,
		ServerPort:           strings.TrimSpace(port),
		CORSOrigin:           strings.TrimSpace(corsOrigin),
		JWTSecret:            strings.TrimSpace(jwtSecret),
		Environment:          strings.TrimSpace(env),
		GoogleClientID:       strings.TrimSpace(googleClientID),
		GoogleClientSecret:   strings.TrimSpace(googleClientSecret),
		GoogleRedirectURI:    strings.TrimSpace(googleRedirectURI),
		TrustedProxies:       trustedProxies,
		CookieSameSite:       cookieSameSite,
		OAuthStateSecret:     oauthStateSecret,
	}, nil
}

// deriveOAuthStateSecret separates the OAuth state MAC key from the JWT signing key.
func deriveOAuthStateSecret(jwtSecret string) string {
	mac := hmac.New(sha256.New, []byte(jwtSecret))
	mac.Write([]byte("bayesmarket-oauth-state-v1"))
	return hex.EncodeToString(mac.Sum(nil))
}

// IsDevOrLocal returns true if the current environment is dev or local.
func (c *Config) IsDevOrLocal() bool {
	if c == nil {
		return false
	}
	env := strings.ToLower(strings.TrimSpace(c.Environment))
	return env == "local" || env == "dev" || env == "development"
}
