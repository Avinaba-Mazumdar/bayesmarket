package rest

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/shopspring/decimal"
)

// Refresh sessions keep a guest or Google account reachable after the 1-hour access token expires,
// and across tab closes. The refresh token is an opaque random value kept in an HttpOnly cookie that
// only the auth endpoints receive. The database stores its SHA-256 hash, never the value.
//
// Each refresh rotates the token. Presenting a token that was already rotated means it was copied,
// so every refresh session for that account is revoked and the reader must sign in again.
const (
	refreshCookieName = "bm_refresh"
	refreshCookiePath = "/api/v1/auth"
	refreshTokenTTL   = 30 * 24 * time.Hour
)

func newRefreshToken() (token string, hash string, err error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", "", err
	}
	token = base64.RawURLEncoding.EncodeToString(raw)
	return token, hashRefreshToken(token), nil
}

func hashRefreshToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// setRefreshCookie writes the refresh cookie. Production uses SameSite=None; Secure because the
// frontend and API are usually on different sites; local development uses Lax over plain HTTP.
func (h *AuthHandler) setRefreshCookie(c *gin.Context, token string, maxAge int) {
	cookie := &http.Cookie{
		Name:     refreshCookieName,
		Value:    token,
		Path:     refreshCookiePath,
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   !h.isDevOrLocal,
		SameSite: http.SameSiteNoneMode,
	}
	if h.isDevOrLocal {
		cookie.SameSite = http.SameSiteLaxMode
	}
	http.SetCookie(c.Writer, cookie)
}

func (h *AuthHandler) clearRefreshCookie(c *gin.Context) {
	h.setRefreshCookie(c, "", -1)
}

// attachRefreshSession starts a refresh session for an account that just signed in. A failure is
// logged and sign-in still succeeds; the access token works, it just cannot be renewed.
func (h *AuthHandler) attachRefreshSession(c *gin.Context, userID string) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return
	}
	token, hash, err := newRefreshToken()
	if err != nil {
		log.Printf("[WARN] refresh token generation failed: %v", err)
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()
	if _, err := h.pool.Exec(ctx, `
		INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3);
	`, id, hash, time.Now().UTC().Add(refreshTokenTTL)); err != nil {
		log.Printf("[WARN] refresh session could not be stored: %v", err)
		return
	}
	h.setRefreshCookie(c, token, int(refreshTokenTTL.Seconds()))
}

// HandleRefresh exchanges a valid refresh cookie for a new access token and a rotated refresh cookie.
//
// POST /api/v1/auth/refresh
func (h *AuthHandler) HandleRefresh(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	presented, err := c.Cookie(refreshCookieName)
	if err != nil || presented == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "no_session", "message": "No refresh session on this device"})
		return
	}
	hash := hashRefreshToken(presented)

	tx, err := h.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to start session refresh"})
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Lock the presented token so concurrent refreshes with it serialize
	var userID uuid.UUID
	var expiresAt time.Time
	var revokedAt *time.Time
	err = tx.QueryRow(ctx, `
		SELECT user_id, expires_at, revoked_at
		FROM refresh_tokens
		WHERE token_hash = $1
		FOR UPDATE;
	`, hash).Scan(&userID, &expiresAt, &revokedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		h.clearRefreshCookie(c)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "no_session", "message": "Refresh session is no longer valid"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to start session refresh"})
		return
	}

	if revokedAt != nil {
		// A rotated token was presented again: assume it was copied and end every session for the account.
		if _, err := tx.Exec(ctx, `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL;`, userID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to end sessions"})
			return
		}
		if err := tx.Commit(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to end sessions"})
			return
		}
		log.Printf("[SECURITY] Reused refresh token for user %s; all refresh sessions revoked", userID)
		h.clearRefreshCookie(c)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "no_session", "message": "Refresh session is no longer valid"})
		return
	}
	if time.Now().UTC().After(expiresAt) {
		h.clearRefreshCookie(c)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "no_session", "message": "Refresh session has expired"})
		return
	}

	var (
		user      UserResponse
		email     *string
		name      *string
		avatar    *string
		isAdmin   bool
		cash      decimal.Decimal
		createdAt time.Time
	)
	err = tx.QueryRow(ctx, `
		SELECT is_guest, auth_provider, email, name, avatar_url, cash_balance, created_at, is_admin
		FROM users
		WHERE id = $1;
	`, userID).Scan(&user.IsGuest, &user.AuthProvider, &email, &name, &avatar, &cash, &createdAt, &isAdmin)
	if errors.Is(err, pgx.ErrNoRows) {
		h.clearRefreshCookie(c)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "no_session", "message": "Account no longer exists"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to load account"})
		return
	}

	newToken, newHash, err := newRefreshToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "auth_error", "message": "Failed to create refresh session"})
		return
	}
	if _, err := tx.Exec(ctx, `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1;`, hash); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to rotate refresh session"})
		return
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3);
	`, userID, newHash, time.Now().UTC().Add(refreshTokenTTL)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to rotate refresh session"})
		return
	}
	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to rotate refresh session"})
		return
	}

	accessToken, err := h.generateJWT(userID.String(), user.IsGuest, isAdmin, deref(email), deref(name), deref(avatar), user.AuthProvider)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "auth_error", "message": "Failed to sign authentication token"})
		return
	}

	user.ID = userID.String()
	user.Email = email
	user.Name = name
	user.AvatarURL = avatar
	user.IsAdmin = isAdmin
	user.IsSuperadmin = isAdmin
	user.CashBalance = cash.StringFixed(8)
	user.CreatedAt = createdAt.Format(time.RFC3339)

	h.setRefreshCookie(c, newToken, int(refreshTokenTTL.Seconds()))
	c.JSON(http.StatusOK, AuthResponse{Token: accessToken, User: user})
}

// HandleLogout ends the refresh session on this device. For a guest account this is permanent.
//
// POST /api/v1/auth/logout
func (h *AuthHandler) HandleLogout(c *gin.Context) {
	if presented, err := c.Cookie(refreshCookieName); err == nil && presented != "" {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		if _, err := h.pool.Exec(ctx, `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL;`, hashRefreshToken(presented)); err != nil {
			log.Printf("[WARN] failed to revoke refresh token on logout: %v", err)
		}
	}
	h.clearRefreshCookie(c)
	c.Status(http.StatusNoContent)
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
