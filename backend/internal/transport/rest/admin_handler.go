package rest

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/bayesmarket/bayesmarket/internal/amm"
	"github.com/bayesmarket/bayesmarket/internal/middleware"
	"github.com/bayesmarket/bayesmarket/internal/transport/ws"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
)

// SystemAdminID is the designated system administrator UUID used for admin-mediated resolutions without a user JWT.
var SystemAdminID = uuid.MustParse("00000000-0000-0000-0000-000000000001")

// CreateMarketRequest defines input payload for creating a new prediction market.
type CreateMarketRequest struct {
	Title                 string `json:"title" binding:"required"`
	Description           string `json:"description" binding:"required"`
	Category              string `json:"category" binding:"required"`
	ResolutionSource      string `json:"resolution_source" binding:"required"`
	ResolutionDate        string `json:"resolution_date" binding:"required"`
	ImageURL              string `json:"image_url"`
	InitialCollateralUSDC string `json:"initial_collateral_usdc"` // e.g. "10000.00000000" (default 10000)
	InitialProbabilityYes string `json:"initial_probability_yes"` // e.g. "0.50000000" or "50" (default 0.5)
	InitialProbabilityNo  string `json:"initial_probability_no"`  // e.g. "0.50000000" or "50" (optional)
}

// EditMarketRequest defines input payload for updating an existing prediction market.
type EditMarketRequest struct {
	Title            *string `json:"title"`
	Description      *string `json:"description"`
	Category         *string `json:"category"`
	ResolutionSource *string `json:"resolution_source"`
	ResolutionDate   *string `json:"resolution_date"`
	ImageURL         *string `json:"image_url"`
	Status           *string `json:"status"` // 'active', 'suspended', 'locked'
}

// ResolveMarketRequest defines input payload for settling a prediction market.
type ResolveMarketRequest struct {
	WinningOutcome string `json:"winning_outcome" binding:"required"`
	OracleProof    string `json:"oracle_proof" binding:"required"`
	// ResolveEarly must be set to settle a market before its resolution_date (e.g. the event
	// already happened). Without it, early resolution is refused.
	ResolveEarly bool `json:"resolve_early"`
}

// ResolveMarketResponse defines the settlement receipt returned upon successful resolution.
type ResolveMarketResponse struct {
	Status           string `json:"status"`
	MarketID         string `json:"market_id"`
	WinningOutcome   string `json:"winning_outcome"`
	TotalPayoutUSDC  string `json:"total_payout_usdc"`
	WinnersCredited  int    `json:"winners_credited"`
	OracleProof      string `json:"oracle_proof"`
	ProofHash        string `json:"proof_hash,omitempty"`
	SettlementDigest string `json:"settlement_digest,omitempty"`
	ResolvedAt       string `json:"resolved_at"`
}

// AdminHandler manages administrative operations including market resolution and payout distribution.
type AdminHandler struct {
	pool        *pgxpool.Pool
	hub         *ws.Hub
	locks       *marketLockRegistry
	marketCache *MarketCache
}

// NewAdminHandler constructs an AdminHandler.
func NewAdminHandler(pool *pgxpool.Pool, hub *ws.Hub) *AdminHandler {
	return &AdminHandler{
		pool:  pool,
		hub:   hub,
		locks: newMarketLockRegistry(),
	}
}

// SetMarketCache attaches a MarketCache instance for resolution invalidation.
func (h *AdminHandler) SetMarketCache(mc *MarketCache) {
	h.marketCache = mc
}

// HandleResolveMarket resolves a prediction market, credits winning share holders, and records double-entry ledger audits.
//
// POST /api/v1/admin/markets/:id/resolve
func (h *AdminHandler) HandleResolveMarket(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	marketIDParam := strings.TrimSpace(c.Param("id"))
	marketID, err := uuid.Parse(marketIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_market_id", "message": "Market ID must be a valid UUID"})
		return
	}

	idempotencyKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if idempotencyKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "idempotency_key_required",
			"message": "Idempotency-Key header is required for market resolution",
		})
		return
	}

	var req ResolveMarketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_payload", "message": "Payload must include winning_outcome ('YES'|'NO') and oracle_proof"})
		return
	}

	outcome, valErr := ParseOutcome(req.WinningOutcome)
	if valErr != nil {
		c.JSON(valErr.StatusCode, gin.H{"error": valErr.ErrorCode, "message": valErr.Message})
		return
	}
	winningOutcome := string(outcome)

	oracleProof := strings.TrimSpace(req.OracleProof)
	if oracleProof == "" || len(oracleProof) < 4 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_proof", "message": "oracle_proof must contain substantive resolution evidence"})
		return
	}
	proofHash := fmt.Sprintf("%x", sha256.Sum256([]byte(oracleProof)))

	actorID, exists := middleware.GetUserID(c)
	if !exists || actorID == uuid.Nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "Superadmin authentication required",
		})
		return
	}

	// Acquire in-process mutex lock to prevent concurrent mutation collisions
	unlock := h.locks.acquire("market:" + marketID.String())
	defer unlock()

	// Check idempotency cache first
	cachedResp, found, err := GetCachedIdempotencyResponse(ctx, h.pool, actorID, "resolve", idempotencyKey)
	if err == nil && found {
		c.Header("X-Cache-Lookup", "HIT-IDEMPOTENT")
		c.Data(http.StatusOK, "application/json", cachedResp)
		return
	}

	// Execute settlement with resilient retry loop for transient database concurrency conflicts
	responseObj, err := ExecuteSerializableWithRetry(ctx, 25, func() (*ResolveMarketResponse, error) {
		return h.executeResolutionTx(ctx, marketID, winningOutcome, proofHash, oracleProof, req.ResolveEarly, actorID, idempotencyKey)
	})

	if err != nil {
		if errors.Is(err, ErrIdempotencyReplay) {
			if cached, ok, _ := GetCachedIdempotencyResponse(ctx, h.pool, actorID, "resolve", idempotencyKey); ok {
				c.Data(http.StatusOK, "application/json", cached)
				return
			}
		}
		var appErr *AppError
		if errors.As(err, &appErr) {
			c.JSON(appErr.StatusCode, gin.H{"error": appErr.ErrorCode, "message": appErr.Message})
			return
		}
		if IsSerializationOrDeadlock(err) {
			c.JSON(http.StatusConflict, gin.H{
				"error":   "concurrency_conflict",
				"message": "Settlement transaction experienced concurrency conflicts after multiple retries. Please retry.",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to settle market resolution"})
		return
	}

	if h.marketCache != nil {
		h.marketCache.Invalidate(marketID.String())
	}

	// 9. Broadcast MARKET_RESOLVED WebSocket frame to connected clients
	if h.hub != nil {
		h.hub.BroadcastMarketResolved(ws.MarketResolvedMessage{
			Type:           ws.MessageTypeMarketResolved,
			MarketID:       marketID.String(),
			WinningOutcome: winningOutcome,
			Timestamp:      responseObj.ResolvedAt,
		})
	}

	c.JSON(http.StatusOK, responseObj)
}

func (h *AdminHandler) executeResolutionTx(
	ctx context.Context,
	marketID uuid.UUID,
	winningOutcome string,
	proofHash string,
	oracleProof string,
	resolveEarly bool,
	actorID uuid.UUID,
	idempotencyKey string,
) (*ResolveMarketResponse, error) {
	tx, err := h.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	// Lock order (ARCHITECTURE.md "Row-lock order"): market -> pool -> users -> positions
	var currentStatus, currentWinningOutcome, resolutionSource string
	var resolutionDate time.Time
	marketQuery := `
		SELECT status, COALESCE(winning_outcome, ''), resolution_source, resolution_date
		FROM markets
		WHERE id = $1
		FOR UPDATE;
	`
	err = tx.QueryRow(ctx, marketQuery, marketID).Scan(&currentStatus, &currentWinningOutcome, &resolutionSource, &resolutionDate)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, &AppError{StatusCode: http.StatusNotFound, ErrorCode: "market_not_found", Message: "Market does not exist"}
		}
		return nil, err
	}

	switch currentStatus {
	case "active", "suspended", "locked":
	case "resolved", "settled":
		return nil, &AppError{
			StatusCode: http.StatusConflict,
			ErrorCode:  "market_already_resolved",
			Message:    fmt.Sprintf("Market is already resolved with outcome '%s'", currentWinningOutcome),
		}
	case "voided":
		return nil, &AppError{StatusCode: http.StatusConflict, ErrorCode: "market_voided", Message: "Voided markets cannot be resolved"}
	default:
		return nil, &AppError{StatusCode: http.StatusConflict, ErrorCode: "market_not_resolvable", Message: fmt.Sprintf("Markets in status '%s' cannot be resolved", currentStatus)}
	}

	if !resolveEarly && time.Now().UTC().Before(resolutionDate) {
		return nil, &AppError{
			StatusCode: http.StatusConflict,
			ErrorCode:  "resolution_date_not_reached",
			Message:    fmt.Sprintf("Market resolution date (%s) has not passed. Set resolve_early to settle before it.", resolutionDate.UTC().Format(time.RFC3339)),
		}
	}

	var collateralReserve decimal.Decimal
	err = tx.QueryRow(ctx, "SELECT collateral_reserve FROM liquidity_pools WHERE market_id = $1 FOR UPDATE;", marketID).Scan(&collateralReserve)
	if err != nil {
		return nil, err
	}

	if err := lockOpenPositionHolders(ctx, tx, marketID); err != nil {
		return nil, err
	}

	// Winners redeem $1.00 per share from collateral
	var totalPayout decimal.Decimal
	var winnerCount int
	err = tx.QueryRow(ctx, `
		SELECT COALESCE(SUM(shares_owned), 0), COUNT(*)
		FROM user_positions
		WHERE market_id = $1 AND outcome = $2 AND shares_owned > 0;
	`, marketID, winningOutcome).Scan(&totalPayout, &winnerCount)
	if err != nil {
		return nil, err
	}

	// Solvency assertion: pool collateral must be sufficient to back all winning payouts
	if totalPayout.GreaterThan(collateralReserve) {
		log.Printf("[CRITICAL RESOLUTION SOLVENCY FAILURE] MarketID=%s totalPayout=%s exceeds collateralReserve=%s",
			marketID.String(), totalPayout.StringFixed(8), collateralReserve.StringFixed(8))
		return nil, &AppError{
			StatusCode: http.StatusInternalServerError,
			ErrorCode:  "collateral_insolvency",
			Message:    fmt.Sprintf("Settlement total payout (%s USDC) exceeds collateral reserve (%s USDC)", totalPayout.StringFixed(4), collateralReserve.StringFixed(4)),
		}
	}

	settlementTxID := uuid.New()

	// Set-based settlement: a fixed number of statements regardless of holder count.
	// Every open position is burned; winning positions are also paid from collateral.
	if _, err := tx.Exec(ctx, `
		WITH open AS (
			SELECT user_id, outcome, shares_owned
			FROM user_positions
			WHERE market_id = $2 AND shares_owned > 0
		)
		INSERT INTO ledger_entries (transaction_id, user_id, market_id, account, asset, delta, entry_type)
		SELECT $1::uuid, user_id, $2::uuid, 'position_' || lower(outcome), outcome, -shares_owned, 'settlement' FROM open
		UNION ALL
		SELECT $1::uuid, user_id, $2::uuid, 'outcome_supply', outcome, shares_owned, 'settlement' FROM open
		UNION ALL
		SELECT $1::uuid, user_id, $2::uuid, 'pool_collateral', 'USDC', -shares_owned, 'settlement' FROM open WHERE outcome = $3
		UNION ALL
		SELECT $1::uuid, user_id, $2::uuid, 'user_cash', 'USDC', shares_owned, 'settlement' FROM open WHERE outcome = $3;
	`, settlementTxID, marketID, winningOutcome); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE users u
		SET cash_balance = u.cash_balance + p.shares_owned, last_active = NOW()
		FROM user_positions p
		WHERE p.user_id = u.id AND p.market_id = $1 AND p.outcome = $2 AND p.shares_owned > 0;
	`, marketID, winningOutcome); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE user_positions
		SET shares_owned = 0, updated_at = NOW()
		WHERE market_id = $1 AND shares_owned > 0;
	`, marketID); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE liquidity_pools
		SET collateral_reserve = collateral_reserve - $1, updated_at = NOW()
		WHERE market_id = $2;
	`, totalPayout, marketID); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, "UPDATE markets SET status = 'resolved', winning_outcome = $1 WHERE id = $2;", winningOutcome, marketID); err != nil {
		return nil, err
	}

	if err := assertTransactionBalanced(ctx, tx, settlementTxID); err != nil {
		return nil, err
	}

	nowStr := time.Now().UTC().Format(time.RFC3339)
	settlementPayload := fmt.Sprintf("%s:%s:%s:%s:%s", marketID.String(), winningOutcome, totalPayout.StringFixed(8), proofHash, nowStr)
	settlementDigest := fmt.Sprintf("%x", sha256.Sum256([]byte(settlementPayload)))

	responseObj := ResolveMarketResponse{
		Status:           "resolved",
		MarketID:         marketID.String(),
		WinningOutcome:   winningOutcome,
		TotalPayoutUSDC:  totalPayout.StringFixed(8),
		WinnersCredited:  winnerCount,
		OracleProof:      oracleProof,
		ProofHash:        proofHash,
		SettlementDigest: settlementDigest,
		ResolvedAt:       nowStr,
	}

	respJSON, err := json.Marshal(responseObj)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO idempotency_keys (actor_id, operation, idempotency_key, response)
		VALUES ($1, 'resolve', $2, $3);
	`, actorID, idempotencyKey, respJSON); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	log.Printf("[AUTHORITATIVE RESOLUTION AUDIT] MarketID=%s WinningOutcome=%s TotalPayout=%s Winners=%d ProofHash=%s SettlementDigest=%s ActorID=%s ResolutionSource=%q",
		marketID.String(), winningOutcome, totalPayout.StringFixed(8), winnerCount, proofHash, settlementDigest, actorID.String(), resolutionSource)

	return &responseObj, nil
}

// lockOpenPositionHolders takes row locks on every user holding an open position in the market,
// in user-ID order, then on those positions. Callers must already hold the market and pool locks.
func lockOpenPositionHolders(ctx context.Context, tx pgx.Tx, marketID uuid.UUID) error {
	if _, err := tx.Exec(ctx, `
		SELECT u.id FROM users u
		WHERE u.id IN (SELECT user_id FROM user_positions WHERE market_id = $1 AND shares_owned > 0)
		ORDER BY u.id
		FOR UPDATE;
	`, marketID); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `
		SELECT id FROM user_positions
		WHERE market_id = $1 AND shares_owned > 0
		ORDER BY user_id, outcome
		FOR UPDATE;
	`, marketID)
	return err
}

// HandleVerifyAdmin validates the admin credential and returns 200 OK.
//
// GET /api/v1/admin/verify
func (h *AdminHandler) HandleVerifyAdmin(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	userEmail, _ := c.Get(middleware.CtxUserEmailKey)
	c.JSON(http.StatusOK, gin.H{
		"status":        "authorized",
		"message":       "Admin credential is valid",
		"is_admin":      true,
		"is_superadmin": true,
		"user_id":       userID.String(),
		"email":         userEmail,
	})
}

var slugRegex = regexp.MustCompile(`[^a-z0-9]+`)

func slugifyTitle(title string) string {
	slug := strings.ToLower(strings.TrimSpace(title))
	slug = slugRegex.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if len(slug) > 80 {
		slug = slug[:80]
		slug = strings.Trim(slug, "-")
	}
	if slug == "" {
		slug = "market-" + uuid.New().String()[:8]
	}
	return slug
}

// Market text limits. Title, category and image_url mirror the VARCHAR columns so oversized input
// is a 400 instead of a database error; description and resolution_source (TEXT) are capped to
// keep payloads reasonable.
const (
	maxMarketTitleLen       = 255
	maxMarketDescriptionLen = 10000
	maxMarketCategoryLen    = 64
	maxMarketSourceLen      = 2000
	maxMarketImageURLLen    = 512
)

// Market creation bounds. Probabilities are fractions in [0.01, 0.99] with at most 8 decimal
// places; collateral is a positive USDC amount with at most 8 decimal places.
var (
	minMarketProbability = decimal.RequireFromString("0.01")
	maxMarketProbability = decimal.RequireFromString("0.99")
	minMarketCollateral  = decimal.NewFromInt(100)
	maxMarketCollateral  = MaxTradeAmountUSDC
)

// validateMarketText checks field lengths in characters. Empty values pass; callers decide which
// fields are required.
func validateMarketText(title, description, category, source, imageURL string) *AppError {
	fields := []struct {
		name  string
		value string
		max   int
	}{
		{"title", title, maxMarketTitleLen},
		{"description", description, maxMarketDescriptionLen},
		{"category", category, maxMarketCategoryLen},
		{"resolution_source", source, maxMarketSourceLen},
		{"image_url", imageURL, maxMarketImageURLLen},
	}
	for _, f := range fields {
		if utf8.RuneCountInString(f.value) > f.max {
			return &AppError{
				StatusCode: http.StatusBadRequest,
				ErrorCode:  "invalid_" + f.name,
				Message:    fmt.Sprintf("%s must be at most %d characters", f.name, f.max),
			}
		}
	}
	return nil
}

// parseMarketProbability parses a probability given as a fraction (e.g. "0.37"). Percentages are
// not accepted: "1.5" would otherwise be ambiguous between 1.5% and an invalid fraction.
func parseMarketProbability(raw, field string) (decimal.Decimal, *AppError) {
	invalid := &AppError{
		StatusCode: http.StatusBadRequest,
		ErrorCode:  "invalid_probability",
		Message:    fmt.Sprintf("%s must be a fraction between 0.01 and 0.99 with at most 8 decimal places (e.g. \"0.37\")", field),
	}
	p, err := decimal.NewFromString(strings.TrimSpace(raw))
	if err != nil || !p.Equal(p.Truncate(amm.StoragePrecision)) {
		return decimal.Zero, invalid
	}
	if p.LessThan(minMarketProbability) || p.GreaterThan(maxMarketProbability) {
		return decimal.Zero, invalid
	}
	return p, nil
}

func parseResolutionDate(raw string) (time.Time, error) {
	raw = strings.TrimSpace(raw)
	formats := []string{
		time.RFC3339,
		"2006-01-02T15:04:05Z07:00",
		"2006-01-02T15:04:05",
		"2006-01-02T15:04",
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"2006-01-02",
	}
	for _, f := range formats {
		if t, err := time.Parse(f, raw); err == nil {
			return t.UTC(), nil
		}
	}
	return time.Time{}, fmt.Errorf("invalid resolution date; expected RFC3339 or ISO-8601 (e.g. 2026-12-31T23:59:59Z)")
}

// HandleCreateMarket provisions a new prediction market and calibrates its CPMM liquidity pool.
//
// POST /api/v1/admin/markets
func (h *AdminHandler) HandleCreateMarket(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	var req CreateMarketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": "Required fields: title, description, category, resolution_source, resolution_date",
		})
		return
	}

	req.Title = strings.TrimSpace(req.Title)
	req.Description = strings.TrimSpace(req.Description)
	req.Category = strings.ToLower(strings.TrimSpace(req.Category))
	req.ResolutionSource = strings.TrimSpace(req.ResolutionSource)
	req.ImageURL = strings.TrimSpace(req.ImageURL)
	if req.Title == "" || req.Description == "" || req.Category == "" || req.ResolutionSource == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": "Title, description, category, and resolution_source cannot be empty",
		})
		return
	}
	if appErr := validateMarketText(req.Title, req.Description, req.Category, req.ResolutionSource, req.ImageURL); appErr != nil {
		c.JSON(appErr.StatusCode, gin.H{"error": appErr.ErrorCode, "message": appErr.Message})
		return
	}

	resolutionDate, err := parseResolutionDate(req.ResolutionDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_date",
			"message": err.Error(),
		})
		return
	}
	if resolutionDate.Before(time.Now().UTC()) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_date",
			"message": "Resolution date must be in the future",
		})
		return
	}

	// 1. Initial Collateral (default 10,000 USDC)
	collateral := decimal.NewFromInt(10000)
	if strings.TrimSpace(req.InitialCollateralUSDC) != "" {
		cDec, valErr := ParseBoundedPositiveDecimal(req.InitialCollateralUSDC, "initial_collateral_usdc", maxMarketCollateral)
		if valErr != nil || cDec.LessThan(minMarketCollateral) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_collateral",
				"message": fmt.Sprintf("Initial pool collateral must be between %s and %s USDC with at most 8 decimal places", minMarketCollateral.String(), maxMarketCollateral.String()),
			})
			return
		}
		collateral = cDec
	}

	// 2. Initial Probability for YES as a fraction (default 0.5)
	probYes := decimal.RequireFromString("0.5")
	if strings.TrimSpace(req.InitialProbabilityYes) != "" {
		pYes, appErr := parseMarketProbability(req.InitialProbabilityYes, "initial_probability_yes")
		if appErr != nil {
			c.JSON(appErr.StatusCode, gin.H{"error": appErr.ErrorCode, "message": appErr.Message})
			return
		}
		probYes = pYes
	}

	probNo := decimal.NewFromInt(1).Sub(probYes)
	if strings.TrimSpace(req.InitialProbabilityNo) != "" {
		pNo, appErr := parseMarketProbability(req.InitialProbabilityNo, "initial_probability_no")
		if appErr != nil {
			c.JSON(appErr.StatusCode, gin.H{"error": appErr.ErrorCode, "message": appErr.Message})
			return
		}
		if !probYes.Add(pNo).Equal(decimal.NewFromInt(1)) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_probability",
				"message": "initial_probability_yes and initial_probability_no must sum to exactly 1",
			})
			return
		}
		probNo = pNo
	}

	// Fixed-point CPMM inventory derivation:
	// Setting R_yes = Collateral * (1 - P_yes) and R_no = Collateral - R_yes guarantees:
	// R_yes + R_no = Collateral exact to 8 decimal places, so P_yes = R_no / Collateral
	reserveYes := collateral.Mul(probNo).Truncate(8)
	reserveNo := collateral.Sub(reserveYes)
	if reserveYes.LessThanOrEqual(decimal.Zero) || reserveNo.LessThanOrEqual(decimal.Zero) || reserveYes.Add(reserveNo).GreaterThan(collateral) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_reserves",
			"message": "Derived reserves must be positive and not exceed total collateral",
		})
		return
	}
	kInvariant := reserveYes.Mul(reserveNo)

	// 3. Unique slug generation & atomic database insertion with collision retry
	baseSlug := slugifyTitle(req.Title)
	imageURL := req.ImageURL
	if imageURL == "" {
		imageURL = fmt.Sprintf("/assets/markets/%s.webp", req.Category)
	}

	var (
		marketID  uuid.UUID
		createdAt time.Time
		slug      string
	)

	queryMarket := `
		INSERT INTO markets (slug, title, description, category, image_url, resolution_source, resolution_date, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
		RETURNING id, created_at;
	`
	queryPool := `
		INSERT INTO liquidity_pools (market_id, reserve_yes, reserve_no, collateral_reserve, k_invariant, total_volume_usdc)
		VALUES ($1, $2, $3, $4, $5, 0);
	`

	for attempt := 0; attempt < 5; attempt++ {
		if attempt == 0 {
			slug = baseSlug
		} else {
			slug = fmt.Sprintf("%s-%s", baseSlug, uuid.New().String()[:6])
		}

		tx, err := h.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to begin transaction",
			})
			return
		}

		err = tx.QueryRow(ctx, queryMarket,
			slug, req.Title, req.Description, req.Category, imageURL, req.ResolutionSource, resolutionDate,
		).Scan(&marketID, &createdAt)

		if err != nil {
			_ = tx.Rollback(ctx)
			// If unique slug constraint violation occurs, retry with an appended unique suffix.
			if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "23505") {
				continue
			}
			log.Printf("[Admin CreateMarket] failed to insert market record: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to insert market record",
			})
			return
		}

		if _, err := tx.Exec(ctx, queryPool, marketID, reserveYes, reserveNo, collateral, kInvariant); err != nil {
			_ = tx.Rollback(ctx)
			log.Printf("[Admin CreateMarket] failed to insert liquidity pool: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to insert liquidity pool",
			})
			return
		}

		// Seed collateral comes from the treasury and is recorded like any other mutation
		ledgerSQL, ledgerArgs, err := buildLedgerInsert(uuid.New(), entryMarketSeed,
			marketSeedEntries(marketID, collateral, reserveYes, reserveNo))
		if err == nil {
			_, err = tx.Exec(ctx, ledgerSQL, ledgerArgs...)
		}
		if err != nil {
			_ = tx.Rollback(ctx)
			log.Printf("[Admin CreateMarket] failed to record seed ledger: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to record market seed ledger",
			})
			return
		}

		if err := tx.Commit(ctx); err != nil {
			log.Printf("[Admin CreateMarket] failed to commit market creation: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to commit market creation transaction",
			})
			return
		}

		// Market creation succeeded!
		break
	}

	if marketID == uuid.Nil {
		c.JSON(http.StatusConflict, gin.H{
			"error":   "slug_conflict",
			"message": "Failed to allocate a unique market slug after multiple attempts",
		})
		return
	}

	if h.marketCache != nil {
		h.marketCache.InvalidateAll()
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":                  marketID.String(),
		"slug":                slug,
		"title":               req.Title,
		"description":         req.Description,
		"category":            req.Category,
		"image_url":           imageURL,
		"resolution_source":   req.ResolutionSource,
		"resolution_date":     resolutionDate.Format(time.RFC3339),
		"status":              "active",
		"reserve_yes":         reserveYes.StringFixed(8),
		"reserve_no":          reserveNo.StringFixed(8),
		"collateral_reserve":  collateral.StringFixed(8),
		"k_invariant":         kInvariant.StringFixed(16),
		"probability_yes":     probYes.StringFixed(4),
		"probability_no":      probNo.StringFixed(4),
		"probability_yes_pct": probYes.Mul(decimal.NewFromInt(100)).StringFixed(2),
		"probability_no_pct":  probNo.Mul(decimal.NewFromInt(100)).StringFixed(2),
		"created_at":          createdAt.Format(time.RFC3339),
	})
}

// HandleEditMarket updates mutable metadata and status of an existing prediction market.
//
// PUT /api/v1/admin/markets/:id
func (h *AdminHandler) HandleEditMarket(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	marketIDParam := strings.TrimSpace(c.Param("id"))
	marketID, err := uuid.Parse(marketIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_market_id", "message": "Market ID must be a valid UUID"})
		return
	}

	var req EditMarketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_payload", "message": "Failed to parse edit market request"})
		return
	}

	// Acquire in-process lock
	unlock := h.locks.acquire("market:" + marketID.String())
	defer unlock()

	tx, err := h.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to begin transaction"})
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Verify market exists
	var (
		curSlug             string
		curTitle            string
		curDescription      string
		curCategory         string
		curImageURL         *string
		curResolutionSource string
		curResolutionDate   time.Time
		curStatus           string
		curWinningOutcome   *string
		curCreatedAt        time.Time
	)
	query := `
		SELECT slug, title, description, category, image_url, resolution_source, resolution_date, status, winning_outcome, created_at
		FROM markets
		WHERE id = $1
		FOR UPDATE;
	`
	err = tx.QueryRow(ctx, query, marketID).Scan(
		&curSlug, &curTitle, &curDescription, &curCategory, &curImageURL,
		&curResolutionSource, &curResolutionDate, &curStatus, &curWinningOutcome, &curCreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "market_not_found", "message": "Market does not exist"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to query market"})
		return
	}

	if curStatus == "resolved" || curStatus == "settled" || curStatus == "voided" {
		c.JSON(http.StatusConflict, gin.H{
			"error":   "market_immutable",
			"message": "Resolved, settled or voided markets cannot be edited",
		})
		return
	}

	newTitle := curTitle
	if req.Title != nil {
		t := strings.TrimSpace(*req.Title)
		if t != "" {
			newTitle = t
		}
	}

	newDesc := curDescription
	if req.Description != nil {
		d := strings.TrimSpace(*req.Description)
		if d != "" {
			newDesc = d
		}
	}

	newCat := curCategory
	if req.Category != nil {
		cat := strings.ToLower(strings.TrimSpace(*req.Category))
		if cat != "" {
			newCat = cat
		}
	}

	newSource := curResolutionSource
	if req.ResolutionSource != nil {
		rs := strings.TrimSpace(*req.ResolutionSource)
		if rs != "" {
			newSource = rs
		}
	}

	newDate := curResolutionDate
	if req.ResolutionDate != nil {
		parsedDate, parseErr := parseResolutionDate(*req.ResolutionDate)
		if parseErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_date", "message": parseErr.Error()})
			return
		}
		if parsedDate.Before(time.Now().UTC()) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_date", "message": "Resolution date must be in the future"})
			return
		}
		newDate = parsedDate
	}

	newImageURL := ""
	if curImageURL != nil {
		newImageURL = *curImageURL
	}
	if req.ImageURL != nil {
		newImageURL = strings.TrimSpace(*req.ImageURL)
	}

	newStatus := curStatus
	if req.Status != nil {
		s := strings.ToLower(strings.TrimSpace(*req.Status))
		switch s {
		case "active", "suspended", "locked":
			newStatus = s
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_status", "message": "Status must be 'active', 'suspended', or 'locked'"})
			return
		}
	}

	// An expired market can only be reopened together with a new, future resolution date.
	if newStatus == "active" && curStatus != "active" && newDate.Before(time.Now().UTC()) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_status",
			"message": "Cannot reactivate a market whose resolution date has passed; set a future resolution_date",
		})
		return
	}

	if appErr := validateMarketText(newTitle, newDesc, newCat, newSource, newImageURL); appErr != nil {
		c.JSON(appErr.StatusCode, gin.H{"error": appErr.ErrorCode, "message": appErr.Message})
		return
	}

	updateQuery := `
		UPDATE markets
		SET title = $1, description = $2, category = $3, resolution_source = $4, resolution_date = $5, image_url = $6, status = $7
		WHERE id = $8;
	`
	_, err = tx.Exec(ctx, updateQuery, newTitle, newDesc, newCat, newSource, newDate, newImageURL, newStatus, marketID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to update market"})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to commit market update"})
		return
	}

	if h.marketCache != nil {
		h.marketCache.Invalidate(marketID.String())
		h.marketCache.InvalidateAll()
	}

	if h.hub != nil {
		h.hub.BroadcastMarketUpdated(ws.MarketUpdatedMessage{
			Type:        ws.MessageTypeMarketUpdated,
			MarketID:    marketID.String(),
			Title:       newTitle,
			Description: newDesc,
			Category:    newCat,
			Status:      newStatus,
			Timestamp:   time.Now().UTC().Format(time.RFC3339),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"id":                marketID.String(),
		"slug":              curSlug,
		"title":             newTitle,
		"description":       newDesc,
		"category":          newCat,
		"image_url":         newImageURL,
		"resolution_source": newSource,
		"resolution_date":   newDate.Format(time.RFC3339),
		"status":            newStatus,
		"created_at":        curCreatedAt.Format(time.RFC3339),
	})
}

// HandleDeleteMarket permanently deletes a prediction market that has never been traded.
// Markets with trades, positions, or ledger history must be voided instead so users are refunded.
//
// DELETE /api/v1/admin/markets/:id
func (h *AdminHandler) HandleDeleteMarket(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	marketIDParam := strings.TrimSpace(c.Param("id"))
	marketID, err := uuid.Parse(marketIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_market_id", "message": "Market ID must be a valid UUID"})
		return
	}

	// Acquire in-process lock
	unlock := h.locks.acquire("market:" + marketID.String())
	defer unlock()

	tx, err := h.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to begin transaction"})
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var title string
	err = tx.QueryRow(ctx, "SELECT title FROM markets WHERE id = $1 FOR UPDATE", marketID).Scan(&title)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "market_not_found", "message": "Market does not exist"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to query market"})
		return
	}

	// Trades and positions are only written while the market row is locked, so this check cannot race.
	// The market's own seed posting is not user activity.
	var hasActivity bool
	activityQuery := `
		SELECT EXISTS (SELECT 1 FROM trades WHERE market_id = $1)
			OR EXISTS (SELECT 1 FROM user_positions WHERE market_id = $1)
			OR EXISTS (SELECT 1 FROM ledger_entries WHERE market_id = $1 AND entry_type <> 'market_seed');
	`
	if err := tx.QueryRow(ctx, activityQuery, marketID).Scan(&hasActivity); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to check market activity"})
		return
	}
	if hasActivity {
		c.JSON(http.StatusConflict, gin.H{
			"error":   "market_has_activity",
			"message": "Market has trading history and cannot be deleted. Void it instead to refund open positions.",
		})
		return
	}

	// An untraded market only has its treasury seed posting; it is removed with the market
	// (ledger_entries.market_id is ON DELETE RESTRICT). Cascades to liquidity_pools.
	if _, err := tx.Exec(ctx, "DELETE FROM ledger_entries WHERE market_id = $1 AND entry_type = 'market_seed';", marketID); err == nil {
		_, err = tx.Exec(ctx, "DELETE FROM markets WHERE id = $1;", marketID)
	}
	if err != nil {
		log.Printf("[ERROR] Failed to delete market %s: %v", marketID.String(), err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to delete market"})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to commit market deletion"})
		return
	}

	if h.marketCache != nil {
		h.marketCache.Invalidate(marketID.String())
		h.marketCache.InvalidateAll()
	}

	if h.hub != nil {
		h.hub.BroadcastMarketDeleted(ws.MarketDeletedMessage{
			Type:      ws.MessageTypeMarketDeleted,
			MarketID:  marketID.String(),
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		})
	}

	log.Printf("[ADMIN ACTION] Deleted market %s (%q)\n", marketID.String(), title)

	c.JSON(http.StatusOK, gin.H{
		"status":    "deleted",
		"market_id": marketID.String(),
		"title":     title,
		"message":   "Market successfully deleted",
	})
}

// VoidMarketResponse defines the refund receipt returned when a market is voided.
type VoidMarketResponse struct {
	Status            string `json:"status"`
	MarketID          string `json:"market_id"`
	TotalRefundUSDC   string `json:"total_refund_usdc"`
	PositionsRefunded int    `json:"positions_refunded"`
	VoidedAt          string `json:"voided_at"`
}

// HandleVoidMarket cancels a market, refunds every open position at cost basis from pool collateral,
// and records the refunds in the ledger. A voided market is terminal: it cannot be traded, edited or resolved.
//
// POST /api/v1/admin/markets/:id/void
func (h *AdminHandler) HandleVoidMarket(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	marketIDParam := strings.TrimSpace(c.Param("id"))
	marketID, err := uuid.Parse(marketIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_market_id", "message": "Market ID must be a valid UUID"})
		return
	}

	idempotencyKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if idempotencyKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "idempotency_key_required",
			"message": "Idempotency-Key header is required for voiding a market",
		})
		return
	}

	actorID, exists := middleware.GetUserID(c)
	if !exists || actorID == uuid.Nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "message": "Admin authentication required"})
		return
	}

	unlock := h.locks.acquire("market:" + marketID.String())
	defer unlock()

	cachedResp, found, err := GetCachedIdempotencyResponse(ctx, h.pool, actorID, "void", idempotencyKey)
	if err == nil && found {
		c.Header("X-Cache-Lookup", "HIT-IDEMPOTENT")
		c.Data(http.StatusOK, "application/json", cachedResp)
		return
	}

	responseObj, err := ExecuteSerializableWithRetry(ctx, 25, func() (*VoidMarketResponse, error) {
		return h.executeVoidTx(ctx, marketID, actorID, idempotencyKey)
	})
	if err != nil {
		var appErr *AppError
		if errors.As(err, &appErr) {
			c.JSON(appErr.StatusCode, gin.H{"error": appErr.ErrorCode, "message": appErr.Message})
			return
		}
		if IsSerializationOrDeadlock(err) {
			c.JSON(http.StatusConflict, gin.H{
				"error":   "concurrency_conflict",
				"message": "Void transaction experienced concurrency conflicts after multiple retries. Please retry.",
			})
			return
		}
		log.Printf("[ERROR] Failed to void market %s: %v", marketID.String(), err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to void market"})
		return
	}

	if h.marketCache != nil {
		h.marketCache.Invalidate(marketID.String())
		h.marketCache.InvalidateAll()
	}

	c.JSON(http.StatusOK, responseObj)
}

func (h *AdminHandler) executeVoidTx(ctx context.Context, marketID, actorID uuid.UUID, idempotencyKey string) (*VoidMarketResponse, error) {
	tx, err := h.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Lock order (ARCHITECTURE.md "Row-lock order"): market -> pool -> users -> positions
	var currentStatus string
	err = tx.QueryRow(ctx, "SELECT status FROM markets WHERE id = $1 FOR UPDATE;", marketID).Scan(&currentStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, &AppError{StatusCode: http.StatusNotFound, ErrorCode: "market_not_found", Message: "Market does not exist"}
		}
		return nil, err
	}
	switch currentStatus {
	case "resolved", "settled":
		return nil, &AppError{StatusCode: http.StatusConflict, ErrorCode: "market_already_resolved", Message: "Resolved markets cannot be voided"}
	case "voided":
		return nil, &AppError{StatusCode: http.StatusConflict, ErrorCode: "market_already_voided", Message: "Market is already voided"}
	}

	var collateralReserve decimal.Decimal
	err = tx.QueryRow(ctx, "SELECT collateral_reserve FROM liquidity_pools WHERE market_id = $1 FOR UPDATE;", marketID).Scan(&collateralReserve)
	if err != nil {
		return nil, err
	}

	if err := lockOpenPositionHolders(ctx, tx, marketID); err != nil {
		return nil, err
	}

	var totalRefund decimal.Decimal
	var positionCount int
	err = tx.QueryRow(ctx, `
		SELECT COALESCE(SUM(total_invested_usdc), 0), COUNT(*)
		FROM user_positions
		WHERE market_id = $1 AND shares_owned > 0;
	`, marketID).Scan(&totalRefund, &positionCount)
	if err != nil {
		return nil, err
	}

	// Solvency assertion: refunds are paid from the collateral that backs the issued shares
	if totalRefund.GreaterThan(collateralReserve) {
		log.Printf("[CRITICAL VOID SOLVENCY FAILURE] MarketID=%s totalRefund=%s exceeds collateralReserve=%s",
			marketID.String(), totalRefund.StringFixed(8), collateralReserve.StringFixed(8))
		return nil, &AppError{
			StatusCode: http.StatusConflict,
			ErrorCode:  "collateral_insolvency",
			Message:    fmt.Sprintf("Total cost-basis refund (%s USDC) exceeds collateral reserve (%s USDC)", totalRefund.StringFixed(4), collateralReserve.StringFixed(4)),
		}
	}

	refundTxID := uuid.New()

	// Set-based refund: positions are cancelled (burned) and their cost basis returned from collateral
	if _, err := tx.Exec(ctx, `
		WITH open AS (
			SELECT user_id, outcome, shares_owned, total_invested_usdc
			FROM user_positions
			WHERE market_id = $2 AND shares_owned > 0
		)
		INSERT INTO ledger_entries (transaction_id, user_id, market_id, account, asset, delta, entry_type)
		SELECT $1::uuid, user_id, $2::uuid, 'position_' || lower(outcome), outcome, -shares_owned, 'refund' FROM open
		UNION ALL
		SELECT $1::uuid, user_id, $2::uuid, 'outcome_supply', outcome, shares_owned, 'refund' FROM open
		UNION ALL
		SELECT $1::uuid, user_id, $2::uuid, 'pool_collateral', 'USDC', -total_invested_usdc, 'refund' FROM open WHERE total_invested_usdc > 0
		UNION ALL
		SELECT $1::uuid, user_id, $2::uuid, 'user_cash', 'USDC', total_invested_usdc, 'refund' FROM open WHERE total_invested_usdc > 0;
	`, refundTxID, marketID); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE users u
		SET cash_balance = u.cash_balance + r.refund, last_active = NOW()
		FROM (
			SELECT user_id, SUM(total_invested_usdc) AS refund
			FROM user_positions
			WHERE market_id = $1 AND shares_owned > 0
			GROUP BY user_id
		) r
		WHERE r.user_id = u.id;
	`, marketID); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE user_positions
		SET shares_owned = 0, updated_at = NOW()
		WHERE market_id = $1 AND shares_owned > 0;
	`, marketID); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE liquidity_pools
		SET collateral_reserve = collateral_reserve - $1, updated_at = NOW()
		WHERE market_id = $2;
	`, totalRefund, marketID); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, "UPDATE markets SET status = 'voided' WHERE id = $1;", marketID); err != nil {
		return nil, err
	}

	if err := assertTransactionBalanced(ctx, tx, refundTxID); err != nil {
		return nil, err
	}

	responseObj := VoidMarketResponse{
		Status:            "voided",
		MarketID:          marketID.String(),
		TotalRefundUSDC:   totalRefund.StringFixed(8),
		PositionsRefunded: positionCount,
		VoidedAt:          time.Now().UTC().Format(time.RFC3339),
	}

	respJSON, err := json.Marshal(responseObj)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO idempotency_keys (actor_id, operation, idempotency_key, response)
		VALUES ($1, 'void', $2, $3);
	`, actorID, idempotencyKey, respJSON); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	log.Printf("[ADMIN ACTION] Voided market %s: refunded %s USDC across %d positions (ActorID=%s)",
		marketID.String(), totalRefund.StringFixed(8), positionCount, actorID.String())

	return &responseObj, nil
}
