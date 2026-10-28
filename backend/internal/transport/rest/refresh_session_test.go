package rest_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Avinaba-Mazumdar/bayesmarket/internal/transport/rest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestRefreshSessionLifecycle covers the guest durability fix (U2): a guest session survives the
// access token, rotates on every refresh, revokes all sessions when an old token is replayed, and
// ends on logout.
func TestRefreshSessionLifecycle(t *testing.T) {
	pool, _, router := getTestEnv(t)
	defer pool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	call := func(path string, cookie *http.Cookie) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodPost, path, nil)
		req.RemoteAddr = "198.51.100.77:4000"
		if cookie != nil {
			req.AddCookie(cookie)
		}
		router.ServeHTTP(w, req)
		return w
	}
	refreshCookie := func(w *httptest.ResponseRecorder) *http.Cookie {
		for _, c := range w.Result().Cookies() {
			if c.Name == "bm_refresh" && c.Value != "" {
				return c
			}
		}
		return nil
	}

	// 1. Guest sign-up issues a refresh cookie, HttpOnly, scoped to the auth path
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/guest", nil)
	req.RemoteAddr = "198.51.100.77:4000"
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code, w.Body.String())
	var auth rest.AuthResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &auth))
	first := refreshCookie(w)
	require.NotNil(t, first, "guest sign-up must set the refresh cookie")
	assert.True(t, first.HttpOnly)
	assert.Equal(t, "/api/v1/auth", first.Path)
	defer func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM idempotency_keys WHERE actor_id = $1", auth.User.ID)
		_, _ = pool.Exec(context.Background(), "DELETE FROM users WHERE id = $1", auth.User.ID)
	}()

	// 2. A refresh without the cookie is refused
	assert.Equal(t, http.StatusUnauthorized, call("/api/v1/auth/refresh", nil).Code)

	// 3. The cookie yields a new access token for the same account, and a rotated cookie
	w2 := call("/api/v1/auth/refresh", first)
	require.Equal(t, http.StatusOK, w2.Code, w2.Body.String())
	var renewed rest.AuthResponse
	require.NoError(t, json.Unmarshal(w2.Body.Bytes(), &renewed))
	assert.NotEmpty(t, renewed.Token)
	assert.Equal(t, auth.User.ID, renewed.User.ID)
	second := refreshCookie(w2)
	require.NotNil(t, second)
	assert.NotEqual(t, first.Value, second.Value, "refresh must rotate the token")

	// 4. Replaying the rotated token revokes every session for the account
	wReplay := call("/api/v1/auth/refresh", first)
	assert.Equal(t, http.StatusUnauthorized, wReplay.Code)
	wAfterReuse := call("/api/v1/auth/refresh", second)
	assert.Equal(t, http.StatusUnauthorized, wAfterReuse.Code, "reuse must revoke the current session too")

	// 5. A new sign-up session can be ended by logout, after which it cannot be refreshed
	w3 := httptest.NewRecorder()
	req3, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/guest", nil)
	req3.RemoteAddr = "198.51.100.78:4000"
	router.ServeHTTP(w3, req3)
	require.Equal(t, http.StatusCreated, w3.Code)
	var other rest.AuthResponse
	require.NoError(t, json.Unmarshal(w3.Body.Bytes(), &other))
	defer func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM users WHERE id = $1", other.User.ID)
	}()
	otherCookie := refreshCookie(w3)
	require.NotNil(t, otherCookie)

	logout := call("/api/v1/auth/logout", otherCookie)
	assert.Equal(t, http.StatusNoContent, logout.Code)
	assert.Equal(t, http.StatusUnauthorized, call("/api/v1/auth/refresh", otherCookie).Code, "logged-out session must not refresh")

	// 6. Stored values are hashes, never the cookie itself
	var stored int
	require.NoError(t, pool.QueryRow(ctx, "SELECT COUNT(*) FROM refresh_tokens WHERE token_hash = $1 OR token_hash = $2", first.Value, second.Value).Scan(&stored))
	assert.Equal(t, 0, stored, "raw refresh tokens must not be stored")
}
