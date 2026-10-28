package rest

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Avinaba-Mazumdar/bayesmarket/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// TestDeleteAccountRequiresTypedConfirmation checks that an account is only erased when the request
// says DELETE exactly. The handler refuses these bodies before it touches the database, so no pool is set.
func TestDeleteAccountRequiresTypedConfirmation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &AuthHandler{}

	for _, body := range []string{"", "{}", `{"confirm":"delete"}`, `{"confirm":"yes"}`, `{"confirm":""}`} {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/auth/account/delete", strings.NewReader(body))
		c.Request.Header.Set("Content-Type", "application/json")
		c.Set(middleware.CtxUserIDKey, uuid.New())

		h.HandleDeleteAccount(c)

		if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "confirmation_required") {
			t.Errorf("body %q: expected 400 confirmation_required, got %d: %s", body, w.Code, w.Body.String())
		}
	}
}

// TestDeleteAccountRequiresAuthentication checks that an anonymous request is refused before anything else.
func TestDeleteAccountRequiresAuthentication(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &AuthHandler{}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/auth/account/delete", strings.NewReader(`{"confirm":"DELETE"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	h.HandleDeleteAccount(c)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 without a user, got %d: %s", w.Code, w.Body.String())
	}
}
