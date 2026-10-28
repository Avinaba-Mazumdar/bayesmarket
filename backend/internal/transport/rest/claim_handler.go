package rest

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/bayesmarket/bayesmarket/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
)

// ClaimHandler handles virtual sandbox currency grants with cooldown protection.
type ClaimHandler struct {
	pool         *pgxpool.Pool
	isDevOrLocal bool
}

// FaucetHandler is a legacy alias for ClaimHandler.
type FaucetHandler = ClaimHandler

// NewClaimHandler constructs a ClaimHandler.
func NewClaimHandler(pool *pgxpool.Pool, isDevOrLocal ...bool) *ClaimHandler {
	isDev := false
	if len(isDevOrLocal) > 0 {
		isDev = isDevOrLocal[0]
	}
	return &ClaimHandler{
		pool:         pool,
		isDevOrLocal: isDev,
	}
}

// NewFaucetHandler is a legacy alias for NewClaimHandler.
var NewFaucetHandler = NewClaimHandler

// claimIdempotencyOp is the idempotency_keys.operation for claims, used for both lookup and write.
const claimIdempotencyOp = "claim"

// claimDeniedError is a rate-limit rejection decided inside the claim transaction.
type claimDeniedError struct {
	code              string
	message           string
	retryAfterSeconds int
}

func (e *claimDeniedError) Error() string { return e.code }

// claimReceipt is the response body for a successful claim; it is also stored as the
// idempotency receipt.
type claimReceipt struct {
	Success         bool             `json:"success"`
	AmountClaimed   string           `json:"amount_claimed"`
	Amount          string           `json:"amount"`
	NewBalance      string           `json:"new_balance"`
	CooldownSeconds int              `json:"cooldown_seconds"`
	User            claimReceiptUser `json:"user"`
}

type claimReceiptUser struct {
	ID          string `json:"id"`
	CashBalance string `json:"cash_balance"`
}

// HandleClaim issues 100 virtual USDC to the user with a 24-hour cooldown.
//
// POST /api/v1/claim or POST /api/v1/faucet
func (h *ClaimHandler) HandleClaim(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "message": "Authentication required"})
		return
	}

	idempotencyKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if idempotencyKey != "" {
		if appErr := validateIdempotencyKey(idempotencyKey); appErr != nil {
			c.JSON(appErr.StatusCode, gin.H{"error": appErr.ErrorCode, "message": appErr.Message})
			return
		}
	}

	// Fast-path idempotency replay: return the stored receipt for a retried claim.
	if idempotencyKey != "" {
		if cached, found, err := GetCachedIdempotencyResponse(ctx, h.pool, userID, claimIdempotencyOp, idempotencyKey, claimFingerprint()); err == nil && found {
			c.Header("X-Cache-Lookup", "HIT-IDEMPOTENT")
			c.Data(http.StatusOK, "application/json", cached)
			return
		}
	}

	clientIP := c.ClientIP()
	receipt, err := ExecuteSerializableWithRetry(ctx, 10, func() (*claimReceipt, error) {
		return h.executeClaimTx(ctx, userID, clientIP, idempotencyKey)
	})
	if err != nil {
		var denied *claimDeniedError
		if errors.As(err, &denied) {
			c.Header("Retry-After", strconv.Itoa(denied.retryAfterSeconds))
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":                      denied.code,
				"message":                    denied.message,
				"cooldown_remaining_seconds": denied.retryAfterSeconds,
			})
			return
		}
		var appErr *AppError
		if errors.As(err, &appErr) {
			c.JSON(appErr.StatusCode, gin.H{"error": appErr.ErrorCode, "message": appErr.Message})
			return
		}
		if errors.Is(err, ErrIdempotencyReplay) || IsUniqueViolation(err) {
			if cached, found, _ := GetCachedIdempotencyResponse(ctx, h.pool, userID, claimIdempotencyOp, idempotencyKey, claimFingerprint()); found {
				c.Header("X-Cache-Lookup", "HIT-IDEMPOTENT")
				c.Data(http.StatusOK, "application/json", cached)
				return
			}
		}
		if IsSerializationOrDeadlock(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "concurrency_conflict", "message": "Claim experienced contention after retries. Please retry."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to process claim"})
		return
	}

	c.JSON(http.StatusOK, receipt)
}

// executeClaimTx runs one claim attempt. All abuse checks run inside the SERIALIZABLE transaction
// after the user row is locked, so concurrent claims for the same user or IP cannot both pass;
// serialization failures are retried by the caller.
func (h *ClaimHandler) executeClaimTx(ctx context.Context, userID uuid.UUID, clientIP, idempotencyKey string) (*claimReceipt, error) {
	const cooldown = 24 * time.Hour
	claimGrant := decimal.NewFromInt(100)
	ipDailyCap := 10
	ipBurstCooldown := 30 * time.Second
	if h.isDevOrLocal {
		ipDailyCap = 100
		ipBurstCooldown = 0
	}

	tx, err := h.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Lock order: claims touch only the user row
	var lockedBalance decimal.Decimal
	if err := tx.QueryRow(ctx, `SELECT cash_balance FROM users WHERE id = $1 FOR UPDATE;`, userID).Scan(&lockedBalance); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, &AppError{StatusCode: http.StatusUnauthorized, ErrorCode: "unauthorized", Message: "User session is invalid or user no longer exists"}
		}
		return nil, err
	}

	// Account cooldown, IP daily cap and IP burst limit (no loopback exemption)
	var (
		lastUserClaim *time.Time
		ipCount       int
		lastIPClaim   *time.Time
	)
	if err := tx.QueryRow(ctx, `
		SELECT
			(SELECT MAX(claimed_at) FROM faucet_claims WHERE user_id = $1),
			(SELECT COUNT(*) FROM faucet_claims WHERE ip_address = $2 AND claimed_at > NOW() - INTERVAL '24 hours'),
			(SELECT MAX(claimed_at) FROM faucet_claims WHERE ip_address = $2 AND claimed_at > NOW() - INTERVAL '24 hours');
	`, userID, clientIP).Scan(&lastUserClaim, &ipCount, &lastIPClaim); err != nil {
		return nil, err
	}
	if lastUserClaim != nil {
		if elapsed := time.Since(*lastUserClaim); elapsed < cooldown {
			return nil, &claimDeniedError{
				code:              "claim_cooldown",
				message:           "Claim cooldown active. Please wait before claiming again.",
				retryAfterSeconds: int((cooldown - elapsed).Seconds()),
			}
		}
	}
	if clientIP != "" {
		if ipCount >= ipDailyCap {
			return nil, &claimDeniedError{
				code:              "claim_ip_limit_exceeded",
				message:           "Maximum daily claims exceeded for this IP address. Please try again tomorrow.",
				retryAfterSeconds: 3600,
			}
		}
		if ipBurstCooldown > 0 && lastIPClaim != nil && time.Since(*lastIPClaim) < ipBurstCooldown {
			return nil, &claimDeniedError{
				code:              "claim_ip_rate_limited",
				message:           "Too many claims from this IP. Please wait a moment before claiming again.",
				retryAfterSeconds: int((ipBurstCooldown - time.Since(*lastIPClaim)).Seconds()) + 1,
			}
		}
	}

	var updatedBalance decimal.Decimal
	if err := tx.QueryRow(ctx, `
		UPDATE users
		SET cash_balance = cash_balance + $1, last_active = NOW()
		WHERE id = $2
		RETURNING cash_balance;
	`, claimGrant, userID).Scan(&updatedBalance); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `INSERT INTO faucet_claims (user_id, ip_address, amount) VALUES ($1, $2, $3);`, userID, clientIP, claimGrant); err != nil {
		return nil, err
	}

	// Double-entry ledger: treasury -> user cash
	ledgerSQL, ledgerArgs, err := buildLedgerInsert(uuid.New(), entryClaim, treasuryGrantEntries(userID, claimGrant))
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, ledgerSQL, ledgerArgs...); err != nil {
		return nil, err
	}

	receipt := &claimReceipt{
		Success:         true,
		AmountClaimed:   claimGrant.StringFixed(8),
		Amount:          claimGrant.StringFixed(0),
		NewBalance:      updatedBalance.StringFixed(8),
		CooldownSeconds: int(cooldown.Seconds()),
		User:            claimReceiptUser{ID: userID.String(), CashBalance: updatedBalance.StringFixed(8)},
	}

	if idempotencyKey != "" {
		respBytes, err := json.Marshal(receipt)
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO idempotency_keys (actor_id, operation, idempotency_key, response, request_hash)
			VALUES ($1, $2, $3, $4, $5);
		`, userID, claimIdempotencyOp, idempotencyKey, respBytes, claimFingerprint()); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return receipt, nil
}

// HandleClaimFaucet is a legacy alias for HandleClaim.
func (h *ClaimHandler) HandleClaimFaucet(c *gin.Context) {
	h.HandleClaim(c)
}

// claimFingerprint identifies a claim. A claim has no body, so the operation alone is bound.
func claimFingerprint() string {
	return requestFingerprint("claim")
}
