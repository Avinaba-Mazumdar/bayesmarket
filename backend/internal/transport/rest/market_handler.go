package rest

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Avinaba-Mazumdar/bayesmarket/internal/amm"
	"github.com/Avinaba-Mazumdar/bayesmarket/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
)

// MarketHandler handles prediction market discovery and authorative quote requests.
type MarketHandler struct {
	pool  *pgxpool.Pool
	cache *MarketCache
}

// NewMarketHandler constructs a MarketHandler.
func NewMarketHandler(pool *pgxpool.Pool, cacheOpt ...*MarketCache) *MarketHandler {
	var cache *MarketCache
	if len(cacheOpt) > 0 && cacheOpt[0] != nil {
		cache = cacheOpt[0]
	} else {
		cache = NewMarketCache(5 * time.Second)
	}
	return &MarketHandler{pool: pool, cache: cache}
}

// Cache returns the underlying MarketCache instance.
func (h *MarketHandler) Cache() *MarketCache {
	return h.cache
}

// MarketSummaryResponse details a market and its current implied probabilities.
type MarketSummaryResponse struct {
	ID               string  `json:"id"`
	Slug             string  `json:"slug"`
	Title            string  `json:"title"`
	Description      string  `json:"description"`
	Category         string  `json:"category"`
	ResolutionSource string  `json:"resolution_source"`
	ResolutionDate   string  `json:"resolution_date"`
	Status           string  `json:"status"`
	WinningOutcome   *string `json:"winning_outcome"` // "YES" or "NO" once resolved, otherwise null
	// Resolution evidence. Set only once the market is resolved; the proof is an https link to the evidence.
	OracleProof       *string          `json:"oracle_proof,omitempty"`
	ProofHash         *string          `json:"proof_hash,omitempty"`
	SettlementDigest  *string          `json:"settlement_digest,omitempty"`
	ResolvedAt        *string          `json:"resolved_at,omitempty"`
	ProbabilityYes    string           `json:"probability_yes"`
	ProbabilityNo     string           `json:"probability_no"`
	ProbabilityYesPct string           `json:"probability_yes_pct"`
	ProbabilityNoPct  string           `json:"probability_no_pct"`
	Reserves          ReservesResponse `json:"reserves"`
	CreatedAt         string           `json:"created_at"`
}

// ReservesResponse holds pool state as canonical decimal strings.
type ReservesResponse struct {
	ReserveYes        string `json:"reserve_yes"`
	ReserveNo         string `json:"reserve_no"`
	CollateralReserve string `json:"collateral_reserve"`
	TotalVolumeUSDC   string `json:"total_volume_usdc"`
}

// QuoteRequest represents the payload for execution quotes.
type QuoteRequest struct {
	Action     string `json:"action"`      // "BUY" (default) or "SELL"
	Outcome    string `json:"outcome"`     // "YES" or "NO"
	AmountUSDC string `json:"amount_usdc"` // Required for BUY
	Shares     string `json:"shares"`      // Required for SELL
}

// HandleGetMarkets returns active prediction markets with category filtering.
//
// GET /api/v1/markets
func (h *MarketHandler) HandleGetMarkets(c *gin.Context) {
	category := strings.ToLower(strings.TrimSpace(c.Query("category")))

	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			if parsed > publicListMax {
				parsed = publicListMax
			}
			limit = parsed
		}
	}

	offset := 0
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	// Fast path: the cache holds the canonical first page (publicListMax markets) per category and
	// each request slices its own limit from it, so one client's ?limit cannot shrink the list
	// served to everyone else.
	if offset == 0 && h.cache != nil {
		if cached, ok := h.cache.GetMarkets(category); ok {
			if len(cached) > limit {
				cached = cached[:limit]
			}
			c.JSON(http.StatusOK, cached)
			return
		}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	queryLimit := limit
	if offset == 0 {
		queryLimit = publicListMax
	}
	rows, err := h.listMarkets(ctx, category, string(models.MarketStatusActive), queryLimit, offset)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "database_error", "Failed to query prediction markets")
		return
	}

	markets := make([]MarketSummaryResponse, 0, len(rows))
	for _, r := range rows {
		markets = append(markets, r.summary)

		// Populate single-market cache as well
		if h.cache != nil {
			h.cache.SetMarket(r.summary.ID, r.summary.Slug, r.summary, r.reserves, r.id)
		}
	}

	if h.cache != nil && offset == 0 {
		h.cache.SetMarkets(category, markets)
	}

	if len(markets) > limit {
		markets = markets[:limit]
	}
	c.JSON(http.StatusOK, markets)
}

// publicListMax is the largest page the public market list serves and caches.
const publicListMax = 100

// adminListableStatuses are the market statuses the admin console can filter by.
var adminListableStatuses = map[string]bool{
	string(models.MarketStatusActive):    true,
	string(models.MarketStatusSuspended): true,
	string(models.MarketStatusLocked):    true,
	string(models.MarketStatusResolved):  true,
	string(models.MarketStatusVoided):    true,
}

// HandleAdminListMarkets returns markets in every lifecycle status so admins can manage
// suspended, locked, resolved and voided markets. It bypasses the public market cache.
//
// GET /api/v1/admin/markets?status=&category=&limit=&offset=
func (h *MarketHandler) HandleAdminListMarkets(c *gin.Context) {
	category := strings.ToLower(strings.TrimSpace(c.Query("category")))

	status := strings.ToLower(strings.TrimSpace(c.Query("status")))
	if status != "" && !adminListableStatuses[status] {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_status",
			"message": "status must be one of 'active', 'suspended', 'locked', 'resolved' or 'voided'",
		})
		return
	}

	limit := 200
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			if parsed > 500 {
				parsed = 500
			}
			limit = parsed
		}
	}

	offset := 0
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.listMarkets(ctx, category, status, limit, offset)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "database_error", "Failed to query prediction markets")
		return
	}

	markets := make([]MarketSummaryResponse, 0, len(rows))
	for _, r := range rows {
		markets = append(markets, r.summary)
	}

	c.JSON(http.StatusOK, markets)
}

type marketListRow struct {
	id       uuid.UUID
	summary  MarketSummaryResponse
	reserves amm.PoolReserves
}

// marketSelectSQL is the column list shared by every query that returns a marketListRow.
const marketSelectSQL = `
		SELECT m.id, m.slug, m.title, m.description, m.category,
		       m.resolution_source, m.resolution_date, m.status, m.winning_outcome, m.created_at,
		       m.oracle_proof, m.proof_hash, m.settlement_digest, m.resolved_at,
		       p.reserve_yes, p.reserve_no, p.collateral_reserve, p.total_volume_usdc
		FROM markets m
		JOIN liquidity_pools p ON p.market_id = m.id
`

// marketRowScanner is satisfied by pgx.Rows and pgx.Row, so one mapper decodes both.
type marketRowScanner interface {
	Scan(dest ...any) error
}

// scanMarketRow decodes one marketSelectSQL row into its response. Market rows are decoded only here.
func scanMarketRow(row marketRowScanner) (marketListRow, error) {
	var (
		id                                           uuid.UUID
		slug, title, desc, cat, resSource, mktStatus string
		winningOutcome                               *string
		oracleProof, proofHash, settlementDigest     *string
		resolvedAt                                   *time.Time
		resDate, createdAt                           time.Time
		rYes, rNo, collateral, volume                decimal.Decimal
	)

	if err := row.Scan(
		&id, &slug, &title, &desc, &cat,
		&resSource, &resDate, &mktStatus, &winningOutcome, &createdAt,
		&oracleProof, &proofHash, &settlementDigest, &resolvedAt,
		&rYes, &rNo, &collateral, &volume,
	); err != nil {
		return marketListRow{}, err
	}

	poolReserves := amm.PoolReserves{
		ReserveYes:        rYes,
		ReserveNo:         rNo,
		CollateralReserve: collateral,
	}
	pYes, pNo, _ := amm.CalculateSpotPrices(poolReserves)

	return marketListRow{
		id:       id,
		reserves: poolReserves,
		summary: MarketSummaryResponse{
			ID:                id.String(),
			Slug:              slug,
			Title:             title,
			Description:       desc,
			Category:          cat,
			ResolutionSource:  resSource,
			ResolutionDate:    resDate.Format(time.RFC3339),
			Status:            mktStatus,
			WinningOutcome:    winningOutcome,
			OracleProof:       oracleProof,
			ProofHash:         proofHash,
			SettlementDigest:  settlementDigest,
			ResolvedAt:        formatOptionalTime(resolvedAt),
			ProbabilityYes:    pYes.StringFixed(8),
			ProbabilityNo:     pNo.StringFixed(8),
			ProbabilityYesPct: pYes.Mul(decimal.NewFromInt(100)).StringFixed(2),
			ProbabilityNoPct:  pNo.Mul(decimal.NewFromInt(100)).StringFixed(2),
			Reserves: ReservesResponse{
				ReserveYes:        rYes.StringFixed(8),
				ReserveNo:         rNo.StringFixed(8),
				CollateralReserve: collateral.StringFixed(8),
				TotalVolumeUSDC:   volume.StringFixed(8),
			},
			CreatedAt: createdAt.Format(time.RFC3339),
		},
	}, nil
}

// formatOptionalTime renders a nullable timestamp as RFC 3339, or nil when it is unset.
func formatOptionalTime(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.UTC().Format(time.RFC3339)
	return &s
}

// listMarkets queries markets with their pool state. An empty category or status matches all.
func (h *MarketHandler) listMarkets(ctx context.Context, category, status string, limit, offset int) ([]marketListRow, error) {
	query := marketSelectSQL + `
		WHERE ($1 = '' OR m.category = $1) AND ($2 = '' OR m.status = $2)
		ORDER BY m.created_at ASC
		LIMIT $3 OFFSET $4;
	`
	rows, err := h.pool.Query(ctx, query, category, status, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []marketListRow
	for rows.Next() {
		row, err := scanMarketRow(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

// HandleGetMarketByID returns detailed market metadata by UUID or Slug.
//
// GET /api/v1/markets/:id
func (h *MarketHandler) HandleGetMarketByID(c *gin.Context) {
	param := strings.TrimSpace(c.Param("id"))
	if param == "" {
		respondError(c, http.StatusBadRequest, "invalid_request", "Market identifier is required")
		return
	}

	// Fast path: check in-memory cache
	if h.cache != nil {
		if cachedSummary, _, _, ok := h.cache.GetMarket(param); ok && cachedSummary != nil {
			c.JSON(http.StatusOK, *cachedSummary)
			return
		}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	keyPredicate, keyArg := marketKeyPredicate("m", param)
	query := marketSelectSQL + `WHERE ` + keyPredicate + `;`

	row, err := scanMarketRow(h.pool.QueryRow(ctx, query, keyArg))
	if err != nil {
		if err == pgx.ErrNoRows {
			respondError(c, http.StatusNotFound, "not_found", "Prediction market not found")
			return
		}
		respondError(c, http.StatusInternalServerError, "database_error", "Failed to query market")
		return
	}

	resp := row.summary
	if h.cache != nil {
		h.cache.SetMarket(resp.ID, resp.Slug, resp, row.reserves, row.id)
	}

	c.JSON(http.StatusOK, resp)
}

// HandleMarketQuote computes an authoritative execution quote using the CPMM engine.
//
// POST /api/v1/markets/:id/quote
func (h *MarketHandler) HandleMarketQuote(c *gin.Context) {
	marketIDParam := strings.TrimSpace(c.Param("id"))
	var req QuoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid_payload", "Malformed JSON quote request payload")
		return
	}

	outcome := amm.Outcome(strings.ToUpper(strings.TrimSpace(req.Outcome)))
	if outcome != amm.OutcomeYES && outcome != amm.OutcomeNO {
		respondError(c, http.StatusBadRequest, "invalid_outcome", "Outcome must be 'YES' or 'NO'")
		return
	}

	action := strings.ToUpper(strings.TrimSpace(req.Action))
	if action == "" {
		action = "BUY"
	}
	if action != "BUY" && action != "SELL" {
		respondError(c, http.StatusBadRequest, "invalid_action", "Action must be 'BUY' or 'SELL'")
		return
	}

	// 1. Check in-memory pool reserves first for sub-millisecond calculation (unless fresh quote requested)
	var marketUUID uuid.UUID
	var poolReserves amm.PoolReserves
	var foundInCache bool

	forceFresh := c.Query("fresh") == "true" || c.GetHeader("Cache-Control") == "no-cache"

	if h.cache != nil && !forceFresh {
		if state, ok := h.cache.GetQuoteState(marketIDParam); ok {
			// Tradability is re-checked on every hit: an entry may describe a market that is not
			// active (e.g. cached by a detail read) or whose resolution date has since passed.
			if appErr := checkTradable(state.Status, state.ResolutionDate); appErr != nil {
				respondError(c, appErr.StatusCode, appErr.ErrorCode, appErr.Message)
				return
			}
			marketUUID = state.MarketUUID
			poolReserves = state.Reserves
			foundInCache = true
		}
	}

	if !foundInCache {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		keyPredicate, keyArg := marketKeyPredicate("m", marketIDParam)
		query := `
			SELECT m.id, m.status, m.resolution_date, p.reserve_yes, p.reserve_no, p.collateral_reserve
			FROM markets m
			JOIN liquidity_pools p ON p.market_id = m.id
			WHERE ` + keyPredicate + `;
		`
		var marketStatus string
		var resDate time.Time
		var rYes, rNo, collateral decimal.Decimal
		err := h.pool.QueryRow(ctx, query, keyArg).Scan(&marketUUID, &marketStatus, &resDate, &rYes, &rNo, &collateral)
		if err != nil {
			if err == pgx.ErrNoRows {
				respondError(c, http.StatusNotFound, "not_found", "Market not found")
				return
			}
			respondError(c, http.StatusInternalServerError, "database_error", "Failed to fetch market reserves")
			return
		}

		if appErr := checkTradable(marketStatus, resDate); appErr != nil {
			respondError(c, appErr.StatusCode, appErr.ErrorCode, appErr.Message)
			return
		}

		poolReserves = amm.PoolReserves{
			ReserveYes:        rYes,
			ReserveNo:         rNo,
			CollateralReserve: collateral,
		}

		if h.cache != nil {
			h.cache.SetReserves(marketUUID.String(), marketIDParam, poolReserves, marketUUID, marketStatus, resDate)
		}
	}

	if action == "BUY" {
		deposit, valErr := ParsePositiveDecimal(req.AmountUSDC, "amount_usdc")
		if valErr != nil {
			respondError(c, valErr.StatusCode, valErr.ErrorCode, valErr.Message)
			return
		}

		quote, err := amm.CalculateCompleteSetBuy(deposit, outcome, poolReserves)
		if err != nil {
			log.Printf("[AMM Buy Quote] calculation error: %v", err)
			respondError(c, http.StatusBadRequest, "amm_error", "Invalid trade parameters for buy quote")
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"market_id":        marketUUID.String(),
			"action":           "BUY",
			"outcome":          string(outcome),
			"deposit_usdc":     quote.DepositUSDC.StringFixed(8),
			"shares_received":  quote.SharesReceived.StringFixed(8),
			"avg_price":        quote.AvgPrice.StringFixed(8),
			"initial_price":    quote.InitialPrice.StringFixed(8),
			"new_price":        quote.NewPrice.StringFixed(8),
			"price_impact_pct": quote.PriceImpactPct.StringFixed(8),
			"new_reserve_yes":  quote.NewReserveYes.StringFixed(8),
			"new_reserve_no":   quote.NewReserveNo.StringFixed(8),
			"new_collateral":   quote.NewCollateral.StringFixed(8),
		})
	} else {
		shares, valErr := ParsePositiveDecimal(req.Shares, "shares")
		if valErr != nil {
			respondError(c, valErr.StatusCode, valErr.ErrorCode, valErr.Message)
			return
		}

		quote, err := amm.CalculateCompleteSetSell(shares, outcome, poolReserves)
		if err != nil {
			log.Printf("[AMM Sell Quote] calculation error: %v", err)
			respondError(c, http.StatusBadRequest, "amm_error", "Invalid trade parameters for sell quote")
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"market_id":        marketUUID.String(),
			"action":           "SELL",
			"outcome":          string(outcome),
			"shares_to_sell":   quote.SharesToSell.StringFixed(8),
			"payout_usdc":      quote.PayoutUSDC.StringFixed(8),
			"avg_price":        quote.AvgPrice.StringFixed(8),
			"initial_price":    quote.InitialPrice.StringFixed(8),
			"new_price":        quote.NewPrice.StringFixed(8),
			"price_impact_pct": quote.PriceImpactPct.StringFixed(8),
			"new_reserve_yes":  quote.NewReserveYes.StringFixed(8),
			"new_reserve_no":   quote.NewReserveNo.StringFixed(8),
			"new_collateral":   quote.NewCollateral.StringFixed(8),
		})
	}
}
