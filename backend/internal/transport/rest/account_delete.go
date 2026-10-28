package rest

import (
	"context"
	"net/http"
	"time"

	"github.com/Avinaba-Mazumdar/bayesmarket/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type deleteAccountRequest struct {
	Confirm string `json:"confirm"`
}

// HandleDeleteAccount removes personal data from the account and revokes its sessions.
// Cash, positions, and ledger rows stay so the books still balance. The reader must send
// {"confirm":"DELETE"}.
//
// POST /api/v1/auth/account/delete
func (h *AuthHandler) HandleDeleteAccount(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		respondError(c, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	var req deleteAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Confirm != "DELETE" {
		respondError(c, http.StatusBadRequest, "confirmation_required", "Send confirm set to DELETE to remove this account's personal data")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	tx, err := h.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "database_error", "Failed to start account deletion")
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx, `
		UPDATE users
		SET email = NULL,
		    name = NULL,
		    avatar_url = NULL,
		    google_id = NULL,
		    ip_address = NULL,
		    auth_provider = 'deleted'
		WHERE id = $1;
	`, userID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "database_error", "Failed to remove personal data")
		return
	}
	if tag.RowsAffected() == 0 {
		respondError(c, http.StatusNotFound, "not_found", "Account no longer exists")
		return
	}
	if _, err := tx.Exec(ctx, `
		UPDATE refresh_tokens SET revoked_at = NOW()
		WHERE user_id = $1 AND revoked_at IS NULL;
	`, userID); err != nil {
		respondError(c, http.StatusInternalServerError, "database_error", "Failed to revoke sessions")
		return
	}
	if _, err := tx.Exec(ctx, `
		UPDATE faucet_claims SET ip_address = 'redacted' WHERE user_id = $1 AND ip_address <> 'redacted';
	`, userID); err != nil {
		respondError(c, http.StatusInternalServerError, "database_error", "Failed to redact claim records")
		return
	}
	if err := tx.Commit(ctx); err != nil {
		respondError(c, http.StatusInternalServerError, "database_error", "Failed to commit account deletion")
		return
	}

	h.clearRefreshCookie(c)
	c.JSON(http.StatusOK, gin.H{
		"status":  "deleted",
		"message": "Personal data was removed and sessions were revoked. Ledger rows were kept so balances stay reconcilable.",
	})
}
