package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Avinaba-Mazumdar/bayesmarket/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// A validly signed token that claims admin must not grant admin access on its own: authority
// comes only from the database, so without one the middleware fails closed (L11).
func TestRequireAdminAuth_DoesNotTrustTokenClaimWithoutDatabase(t *testing.T) {
	const secret = "test-secret-at-least-thirty-two-characters"
	claims := middleware.AuthClaims{
		UserID: uuid.New().String(),
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    middleware.AccessTokenIssuer,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}

	router := gin.New()
	router.GET("/admin", middleware.RequireAdminAuth(secret, nil), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/admin", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when admin cannot be verified against the database, got %d", w.Code)
	}
}
