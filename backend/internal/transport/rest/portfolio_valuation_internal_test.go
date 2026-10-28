package rest

import (
	"testing"

	"github.com/Avinaba-Mazumdar/bayesmarket/internal/amm"
	"github.com/shopspring/decimal"
)

// A large position is worth less than spot x shares because selling it moves the price (L16).
func TestLiquidationValueIncludesPriceImpact(t *testing.T) {
	pool := amm.PoolReserves{
		ReserveYes:        decimal.NewFromInt(5000),
		ReserveNo:         decimal.NewFromInt(5000),
		CollateralReserve: decimal.NewFromInt(10000),
	}
	pYes, _, _ := amm.CalculateSpotPrices(pool)

	small := decimal.NewFromInt(1)
	large := decimal.NewFromInt(2000)
	for _, shares := range []decimal.Decimal{small, large} {
		mark := shares.Mul(pYes).Truncate(amm.StoragePrecision)
		value, method := liquidationValue(shares, "YES", pool, mark)
		if method != valuationLiquidation {
			t.Fatalf("%s shares: expected liquidation valuation, got %s", shares, method)
		}
		if value.GreaterThan(mark) {
			t.Errorf("%s shares: liquidation value %s exceeds mark %s", shares, value, mark)
		}
	}

	largeMark := large.Mul(pYes).Truncate(amm.StoragePrecision)
	largeValue, _ := liquidationValue(large, "YES", pool, largeMark)
	discount := largeMark.Sub(largeValue).Div(largeMark)
	if discount.LessThan(decimal.RequireFromString("0.05")) {
		t.Errorf("expected a 2,000-share sale to price at least 5%% below mark, got value %s vs mark %s", largeValue, largeMark)
	}
}

func TestLiquidationValueFallsBackToMarkWhenPoolCannotPrice(t *testing.T) {
	mark := decimal.NewFromInt(7)
	value, method := liquidationValue(decimal.NewFromInt(10), "YES", amm.PoolReserves{}, mark)
	if method != valuationMark || !value.Equal(mark) {
		t.Errorf("expected mark fallback, got %s %s", value, method)
	}
}
