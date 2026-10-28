package middleware

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/time/rate"
)

const (
	CtxUserIDKey       = "userID"
	CtxIsGuestKey      = "isGuest"
	CtxIsAdminKey      = "isAdmin"
	CtxUserEmailKey    = "userEmail"
	CtxUserNameKey     = "userName"
	CtxUserAvatarKey   = "userAvatar"
	CtxAuthProviderKey = "authProvider"
	CtxAuthClaimsKey   = "authClaims"

	// AccessTokenIssuer is the only issuer accepted on access tokens.
	AccessTokenIssuer = "bayesmarket"
	accessTokenTTL    = time.Hour
)

// AuthClaims is the access-token payload. It carries the account id and the guest flag only.
// Email, name, avatar, and admin authority are loaded from the database when a handler needs them.
// The admin flag in an old token is ignored.
type AuthClaims struct {
	UserID  string `json:"user_id"`
	IsGuest bool   `json:"is_guest"`
	jwt.RegisteredClaims
}

// SignAccessToken signs a one-hour HS256 access token.
func SignAccessToken(secret, userID string, isGuest bool) (string, error) {
	now := time.Now().UTC()
	claims := AuthClaims{
		UserID:  userID,
		IsGuest: isGuest,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    AccessTokenIssuer,
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(accessTokenTTL)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}

// ParseAccessToken verifies an access token. HS256, the bayesmarket issuer, and an expiry are required.
func ParseAccessToken(tokenString, secret string) (*AuthClaims, error) {
	claims := &AuthClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(AccessTokenIssuer),
		jwt.WithExpirationRequired(),
	)
	if err != nil || token == nil || !token.Valid {
		if err == nil {
			err = errors.New("invalid token")
		}
		return nil, err
	}
	if _, err := uuid.Parse(claims.UserID); err != nil {
		return nil, errors.New("malformed user identifier")
	}
	return claims, nil
}

func bearerToken(c *gin.Context) (string, bool) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		return "", false
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return "", false
	}
	token := strings.TrimSpace(parts[1])
	if token == "" {
		return "", false
	}
	return token, true
}

func setSession(c *gin.Context, claims *AuthClaims) {
	userID, _ := uuid.Parse(claims.UserID)
	c.Set(CtxUserIDKey, userID)
	c.Set(CtxIsGuestKey, claims.IsGuest)
	c.Set(CtxAuthClaimsKey, claims)
}

// RequireAuth validates the Bearer JWT in the Authorization header.
func RequireAuth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString, ok := bearerToken(c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Authorization header must be formatted as 'Bearer <token>'",
			})
			return
		}

		claims, err := ParseAccessToken(tokenString, jwtSecret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Invalid or expired session token",
			})
			return
		}
		setSession(c, claims)
		c.Next()
	}
}

// OptionalAuth parses a Bearer JWT if provided, but does not abort if it is absent or invalid.
func OptionalAuth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString, ok := bearerToken(c)
		if !ok {
			c.Next()
			return
		}
		if claims, err := ParseAccessToken(tokenString, jwtSecret); err == nil {
			setSession(c, claims)
		}
		c.Next()
	}
}

// GetUserID retrieves the authenticated user's UUID from the request context.
func GetUserID(c *gin.Context) (uuid.UUID, bool) {
	val, exists := c.Get(CtxUserIDKey)
	if !exists {
		return uuid.Nil, false
	}
	id, ok := val.(uuid.UUID)
	return id, ok
}

// GetIsGuest retrieves whether the authenticated session is an ephemeral guest.
func GetIsGuest(c *gin.Context) bool {
	val, exists := c.Get(CtxIsGuestKey)
	if !exists {
		return false
	}
	isGuest, ok := val.(bool)
	return ok && isGuest
}

// GetIsAdmin reports the database admin flag set by RequireAdminAuth.
// An access token cannot set this flag.
func GetIsAdmin(c *gin.Context) bool {
	val, exists := c.Get(CtxIsAdminKey)
	if !exists {
		return false
	}
	isAdmin, ok := val.(bool)
	return ok && isAdmin
}

// GetClaims retrieves the access-token claims from the request context.
func GetClaims(c *gin.Context) (*AuthClaims, bool) {
	val, exists := c.Get(CtxAuthClaimsKey)
	if !exists {
		return nil, false
	}
	claims, ok := val.(*AuthClaims)
	return claims, ok
}

// adminFailureLimiter tracks failed administrative authorization attempts per client IP.
var adminFailureLimiter = NewRateLimiter(rate.Every(12*time.Second), 5, 60*time.Second)

// SetAdminFailureLimiterDisabled enables or disables failed admin attempt limiting (useful for tests).
func SetAdminFailureLimiterDisabled(disabled bool) {
	adminFailureLimiter.SetDisabled(disabled)
}

// RequireAdminAuth validates that the request comes from an authenticated user with is_admin=true.
// Authority is read from the database on every request. Without a database the request fails closed.
func RequireAdminAuth(jwtSecret string, pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		limiter := adminFailureLimiter.getLimiter(clientIP)

		adminFailureLimiter.mu.RLock()
		disabled := adminFailureLimiter.disabled
		adminFailureLimiter.mu.RUnlock()

		if !disabled && limiter.Tokens() < 1 {
			if !limiter.Allow() {
				c.Header("Retry-After", "60")
				c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
					"error":       "rate_limit_exceeded",
					"message":     "Too many failed admin authorization attempts. Please try again later.",
					"retry_after": 60,
				})
				return
			}
		}

		tokenString, ok := bearerToken(c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Authorization header with user Bearer token is required",
			})
			return
		}

		claims, err := ParseAccessToken(tokenString, jwtSecret)
		if err != nil {
			if !disabled {
				limiter.Allow()
			}
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Invalid or expired user session token",
			})
			return
		}

		parsedID, _ := uuid.Parse(claims.UserID)

		// Admin authority comes only from the database. The token is never trusted for it.
		if pool == nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"error":   "admin_unavailable",
				"message": "Admin verification is unavailable",
			})
			return
		}
		var dbIsAdmin bool
		ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
		defer cancel()
		err = pool.QueryRow(ctx, "SELECT is_admin FROM users WHERE id = $1", parsedID).Scan(&dbIsAdmin)
		if err != nil || !dbIsAdmin {
			if !disabled {
				limiter.Allow()
			}
			log.Printf("[SECURITY] User %s attempted admin access without is_admin privilege from IP=%s path=%s", parsedID, clientIP, c.Request.URL.Path)
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "Admin privileges required (is_admin=true). Admin status can only be granted directly in the database.",
			})
			return
		}

		setSession(c, claims)
		c.Set(CtxIsAdminKey, true)
		c.Next()
	}
}
