package rest

import (
	"context"
	"net/http"
	"time"

	"github.com/bayesmarket/bayesmarket/internal/amm"
	"github.com/bayesmarket/bayesmarket/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
)

// PortfolioHandler returns trader portfolio valuations, open positions, and unrealized P&L.
type PortfolioHandler struct {
	pool *pgxpool.Pool
}

// NewPortfolioHandler constructs a PortfolioHandler.
func NewPortfolioHandler(pool *pgxpool.Pool) *PortfolioHandler {
	return &PortfolioHandler{pool: pool}
}

// Position valuation methods reported in PositionResponse.ValuationMethod.
const (
	// valuationLiquidation: what selling the whole position into the pool now would pay.
	valuationLiquidation = "liquidation"
	// valuationMark: spot price x shares, used only when the pool cannot price a full sale.
	valuationMark = "mark"
)

// PositionResponse details an open position's valuation.
//
// CurrentValueUSDC is the liquidation value (the SELL quote for the whole position), so it
// includes the price impact a large holder would actually pay. MarkValueUSDC is spot x shares
// for reference. Unrealized P&L is computed from CurrentValueUSDC.
type PositionResponse struct {
	ID                string `json:"id"`
	MarketID          string `json:"market_id"`
	MarketSlug        string `json:"market_slug"`
	MarketTitle       string `json:"market_title"`
	Category          string `json:"category"`
	Outcome           string `json:"outcome"`
	SharesOwned       string `json:"shares_owned"`
	AvgBuyPrice       string `json:"avg_buy_price"`
	TotalInvestedUSDC string `json:"total_invested_usdc"`
	CurrentPrice      string `json:"current_price"`
	CurrentValueUSDC  string `json:"current_value_usdc"`
	MarkValueUSDC     string `json:"mark_value_usdc"`
	ValuationMethod   string `json:"valuation_method"`
	UnrealizedPnLUSDC string `json:"unrealized_pnl_usdc"`
	UnrealizedPnLPct  string `json:"unrealized_pnl_pct"`
}

// PortfolioResponse holds aggregate user portfolio metrics.
type PortfolioResponse struct {
	UserID                 string             `json:"user_id"`
	CashBalanceUSDC        string             `json:"cash_balance_usdc"`
	PositionsValueUSDC     string             `json:"positions_value_usdc"`
	TotalPortfolioValue    string             `json:"total_portfolio_value_usdc"`
	TotalInvestedUSDC      string             `json:"total_invested_usdc"`
	TotalUnrealizedPnLUSDC string             `json:"total_unrealized_pnl_usdc"`
	TotalUnrealizedPnLPct  string             `json:"total_unrealized_pnl_pct"`
	Positions              []PositionResponse `json:"positions"`
}

// HandleGetPortfolio computes the mark-to-market valuation of a user's holdings.
//
// GET /api/v1/portfolio
func (h *PortfolioHandler) HandleGetPortfolio(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "message": "Authentication required"})
		return
	}

	// 1. Fetch user's current cash balance
	var cashBalance decimal.Decimal
	err := h.pool.QueryRow(ctx, "SELECT cash_balance FROM users WHERE id = $1", userID).Scan(&cashBalance)
	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "message": "User session is invalid or user not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to query user"})
		return
	}

	// 2. Query active positions
	queryPositions := `
		SELECT p.id, p.market_id, m.slug, m.title, m.category, p.outcome, 
		       p.shares_owned, p.avg_buy_price, p.total_invested_usdc,
		       lp.reserve_yes, lp.reserve_no, lp.collateral_reserve
		FROM user_positions p
		JOIN markets m ON m.id = p.market_id
		JOIN liquidity_pools lp ON lp.market_id = p.market_id
		WHERE p.user_id = $1 AND p.shares_owned > 0
		ORDER BY p.updated_at DESC;
	`
	rows, err := h.pool.Query(ctx, queryPositions, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to query positions"})
		return
	}
	defer rows.Close()

	var (
		positions           []PositionResponse
		totalPositionsValue = decimal.Zero
		totalInvested       = decimal.Zero
		totalUnrealizedPnL  = decimal.Zero
	)

	for rows.Next() {
		var (
			posID, marketID                   uuid.UUID
			slug, title, category, outcome    string
			shares, avgBuyPrice, investedUSDC decimal.Decimal
			rYes, rNo, collateral             decimal.Decimal
		)

		err := rows.Scan(
			&posID, &marketID, &slug, &title, &category, &outcome,
			&shares, &avgBuyPrice, &investedUSDC,
			&rYes, &rNo, &collateral,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error", "message": "Failed to parse position"})
			return
		}

		poolReserves := amm.PoolReserves{
			ReserveYes:        rYes,
			ReserveNo:         rNo,
			CollateralReserve: collateral,
		}
		pYes, pNo, _ := amm.CalculateSpotPrices(poolReserves)

		currentPrice := pYes
		if outcome == "NO" {
			currentPrice = pNo
		}

		markValue := shares.Mul(currentPrice).Truncate(amm.StoragePrecision)
		currentValue, valuationMethod := liquidationValue(shares, outcome, poolReserves, markValue)
		unrealizedPnL := currentValue.Sub(investedUSDC)
		unrealizedPnLPct := decimal.Zero
		if investedUSDC.IsPositive() {
			unrealizedPnLPct = unrealizedPnL.DivRound(investedUSDC, 6).Mul(decimal.NewFromInt(100))
		}

		totalPositionsValue = totalPositionsValue.Add(currentValue)
		totalInvested = totalInvested.Add(investedUSDC)
		totalUnrealizedPnL = totalUnrealizedPnL.Add(unrealizedPnL)

		positions = append(positions, PositionResponse{
			ID:                posID.String(),
			MarketID:          marketID.String(),
			MarketSlug:        slug,
			MarketTitle:       title,
			Category:          category,
			Outcome:           outcome,
			SharesOwned:       shares.StringFixed(8),
			AvgBuyPrice:       avgBuyPrice.StringFixed(8),
			TotalInvestedUSDC: investedUSDC.StringFixed(8),
			CurrentPrice:      currentPrice.StringFixed(8),
			CurrentValueUSDC:  currentValue.StringFixed(8),
			MarkValueUSDC:     markValue.StringFixed(8),
			ValuationMethod:   valuationMethod,
			UnrealizedPnLUSDC: unrealizedPnL.StringFixed(8),
			UnrealizedPnLPct:  unrealizedPnLPct.StringFixed(2),
		})
	}

	if positions == nil {
		positions = []PositionResponse{}
	}

	totalPortfolioValue := cashBalance.Add(totalPositionsValue)
	totalPnLPct := decimal.Zero
	if totalInvested.IsPositive() {
		totalPnLPct = totalUnrealizedPnL.DivRound(totalInvested, 6).Mul(decimal.NewFromInt(100))
	}

	c.JSON(http.StatusOK, PortfolioResponse{
		UserID:                 userID.String(),
		CashBalanceUSDC:        cashBalance.StringFixed(8),
		PositionsValueUSDC:     totalPositionsValue.StringFixed(8),
		TotalPortfolioValue:    totalPortfolioValue.StringFixed(8),
		TotalInvestedUSDC:      totalInvested.StringFixed(8),
		TotalUnrealizedPnLUSDC: totalUnrealizedPnL.StringFixed(8),
		TotalUnrealizedPnLPct:  totalPnLPct.StringFixed(2),
		Positions:              positions,
	})
}

// liquidationValue prices selling the whole position into the pool now. Each position is valued
// independently against the current pool, as the cash-out dialog would quote it. If the pool
// cannot price the sale, the mark value is returned and labelled as such.
func liquidationValue(shares decimal.Decimal, outcome string, pool amm.PoolReserves, markValue decimal.Decimal) (decimal.Decimal, string) {
	quote, err := amm.CalculateCompleteSetSell(shares, amm.Outcome(outcome), pool)
	if err != nil {
		return markValue, valuationMark
	}
	return quote.PayoutUSDC, valuationLiquidation
}
