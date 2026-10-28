package rest

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/shopspring/decimal"
)

// historyRange describes one selectable chart range: how far back to look and how to bucket trades.
type historyRange struct {
	lookback time.Duration // 0 means all time
	bucket   string        // Postgres interval for date_bin
}

var historyRanges = map[string]historyRange{
	"1h":  {lookback: time.Hour, bucket: "1 minute"},
	"24h": {lookback: 24 * time.Hour, bucket: "15 minutes"},
	"7d":  {lookback: 7 * 24 * time.Hour, bucket: "1 hour"},
	"all": {lookback: 0, bucket: "1 day"},
}

const maxHistoryPoints = 1000

// HistoryPoint is one bucket of implied YES probability: the value after the last trade in the bucket.
type HistoryPoint struct {
	Time        string `json:"t"`
	Probability string `json:"p"`
}

// MarketHistoryResponse is the probability history of a market over one range.
type MarketHistoryResponse struct {
	MarketID string         `json:"market_id"`
	Range    string         `json:"range"`
	Points   []HistoryPoint `json:"points"`
}

// MarketTradeResponse is one public trade. Trader identities are never included.
type MarketTradeResponse struct {
	ID             string `json:"id"`
	TradeType      string `json:"trade_type"`
	Outcome        string `json:"outcome"`
	SharesFilled   string `json:"shares_filled"`
	ExecutionPrice string `json:"execution_price"`
	AmountUSDC     string `json:"amount_usdc"`
	CreatedAt      string `json:"created_at"`
}

// resolveMarketUUID maps a market UUID or slug to its UUID, or returns pgx.ErrNoRows.
func (h *MarketHandler) resolveMarketUUID(ctx context.Context, idOrSlug string) (uuid.UUID, error) {
	predicate, arg := marketKeyPredicate("m", idOrSlug)
	var id uuid.UUID
	err := h.pool.QueryRow(ctx, "SELECT m.id FROM markets m WHERE "+predicate+";", arg).Scan(&id)
	return id, err
}

// HandleGetMarketHistory returns the implied YES probability of a market over a range, one point per
// bucket. Points come only from recorded trades, so a range with no trades returns no points.
//
// GET /api/v1/markets/:id/history?range=1h|24h|7d|all
func (h *MarketHandler) HandleGetMarketHistory(c *gin.Context) {
	param := strings.TrimSpace(c.Param("id"))
	rangeKey := strings.ToLower(strings.TrimSpace(c.DefaultQuery("range", "24h")))
	spec, ok := historyRanges[rangeKey]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_range", "message": "range must be one of 1h, 24h, 7d or all"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	marketID, err := h.resolveMarketUUID(ctx, param)
	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found", "message": "Prediction market not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to resolve market"})
		return
	}

	// Lookback is passed as an absolute start time so an "all" range (zero) matches every trade.
	since := time.Unix(0, 0).UTC()
	if spec.lookback > 0 {
		since = time.Now().UTC().Add(-spec.lookback)
	}

	rows, err := h.pool.Query(ctx, `
		SELECT bucket, yes_probability_after
		FROM (
			SELECT DISTINCT ON (bucket) bucket, yes_probability_after
			FROM (
				SELECT date_bin($3::interval, created_at, TIMESTAMPTZ '2000-01-01 00:00:00+00') AS bucket,
				       created_at, yes_probability_after
				FROM trades
				WHERE market_id = $1 AND yes_probability_after IS NOT NULL AND created_at >= $2
			) t
			ORDER BY bucket, created_at DESC
		) latest
		ORDER BY bucket ASC
		LIMIT $4;
	`, marketID, since, spec.bucket, maxHistoryPoints)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to query market history"})
		return
	}
	defer rows.Close()

	points := make([]HistoryPoint, 0)
	for rows.Next() {
		var bucket time.Time
		var prob decimal.Decimal
		if err := rows.Scan(&bucket, &prob); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to read market history"})
			return
		}
		points = append(points, HistoryPoint{Time: bucket.UTC().Format(time.RFC3339), Probability: prob.StringFixed(8)})
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to read market history"})
		return
	}

	c.JSON(http.StatusOK, MarketHistoryResponse{
		MarketID: marketID.String(),
		Range:    rangeKey,
		Points:   points,
	})
}

// HandleGetMarketTrades returns the most recent trades on a market, newest first.
//
// GET /api/v1/markets/:id/trades?limit=50
func (h *MarketHandler) HandleGetMarketTrades(c *gin.Context) {
	param := strings.TrimSpace(c.Param("id"))
	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = min(parsed, 100)
		}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	marketID, err := h.resolveMarketUUID(ctx, param)
	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found", "message": "Prediction market not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to resolve market"})
		return
	}

	rows, err := h.pool.Query(ctx, `
		SELECT id, trade_type, outcome, shares_filled, execution_price, amount_usdc, created_at
		FROM trades
		WHERE market_id = $1
		ORDER BY created_at DESC
		LIMIT $2;
	`, marketID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to query trades"})
		return
	}
	defer rows.Close()

	trades := make([]MarketTradeResponse, 0, limit)
	for rows.Next() {
		var (
			id                        uuid.UUID
			tradeType, outcome        string
			shares, execPrice, amount decimal.Decimal
			createdAt                 time.Time
		)
		if err := rows.Scan(&id, &tradeType, &outcome, &shares, &execPrice, &amount, &createdAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to read trades"})
			return
		}
		trades = append(trades, MarketTradeResponse{
			ID:             id.String(),
			TradeType:      tradeType,
			Outcome:        outcome,
			SharesFilled:   shares.StringFixed(8),
			ExecutionPrice: execPrice.StringFixed(8),
			AmountUSDC:     amount.StringFixed(8),
			CreatedAt:      createdAt.UTC().Format(time.RFC3339),
		})
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to read trades"})
		return
	}

	c.JSON(http.StatusOK, trades)
}
