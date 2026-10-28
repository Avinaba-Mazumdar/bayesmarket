package rest

import (
	"context"
	"fmt"
	"strings"

	"github.com/Avinaba-Mazumdar/bayesmarket/internal/amm"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
)

// Ledger accounts. Every transaction posts entries whose deltas sum to zero per asset, so the
// running sum of an account always equals the snapshot column it mirrors:
//
//	user_cash        USDC     users.cash_balance (per user)
//	pool_collateral  USDC     liquidity_pools.collateral_reserve (per market)
//	system_treasury  USDC     source of seed money: starting balances, claims, market seed collateral
//	position_yes/no  YES/NO   user_positions.shares_owned (per user, market, outcome)
//	pool_reserve     YES/NO   liquidity_pools.reserve_yes / reserve_no (per market)
//	pool_inventory   YES/NO   real shares held by the pool beyond its virtual reserve, set at seeding
//	outcome_supply   YES/NO   minus the shares in existence: complete sets are minted on buy and
//	                          seeding, and burned on sell, settlement and void
const (
	acctUserCash       = "user_cash"
	acctPoolCollateral = "pool_collateral"
	acctSystemTreasury = "system_treasury"
	acctPoolReserve    = "pool_reserve"
	acctPoolInventory  = "pool_inventory"
	acctOutcomeSupply  = "outcome_supply"

	assetUSDC = "USDC"
)

// Ledger entry types.
const (
	entryTrade      = "trade"
	entryClaim      = "claim"
	entrySettlement = "settlement"
	entryRefund     = "refund"
	entryUserSeed   = "user_seed"
	entryMarketSeed = "market_seed"
)

// ledgerEntry is one signed movement of an asset on an account.
type ledgerEntry struct {
	userID   *uuid.UUID
	marketID *uuid.UUID
	account  string
	asset    string
	delta    decimal.Decimal
}

func positionAccount(outcome string) string {
	return "position_" + strings.ToLower(outcome)
}

// Settlement and void refunds post set-based (INSERT ... SELECT over all open positions) using
// the same accounts, and are checked with assertTransactionBalanced before commit.

// buildLedgerInsert validates that the entries balance per asset and returns a single multi-row
// INSERT for them. Zero deltas are skipped. It refuses unbalanced or empty postings so a coding
// error can never write a ledger that cannot be reconciled.
func buildLedgerInsert(txID uuid.UUID, entryType string, entries []ledgerEntry) (string, []any, error) {
	sums := map[string]decimal.Decimal{}
	var values []string
	args := []any{txID, entryType}
	for _, e := range entries {
		if !e.delta.Equal(e.delta.Truncate(amm.StoragePrecision)) {
			return "", nil, fmt.Errorf("ledger: %s %s delta %s exceeds storage precision", e.account, e.asset, e.delta)
		}
		sums[e.asset] = sums[e.asset].Add(e.delta)
		if e.delta.IsZero() {
			continue
		}
		n := len(args)
		values = append(values, fmt.Sprintf("($1, $%d, $%d, $%d, $%d, $%d, $2)", n+1, n+2, n+3, n+4, n+5))
		args = append(args, e.userID, e.marketID, e.account, e.asset, e.delta)
	}
	for asset, sum := range sums {
		if !sum.IsZero() {
			return "", nil, fmt.Errorf("ledger: unbalanced %s posting for %s: %s %s", entryType, asset, sum.StringFixed(8), asset)
		}
	}
	if len(values) == 0 {
		return "", nil, fmt.Errorf("ledger: empty %s posting", entryType)
	}
	query := "INSERT INTO ledger_entries (transaction_id, user_id, market_id, account, asset, delta, entry_type) VALUES " +
		strings.Join(values, ", ") + ";"
	return query, args, nil
}

// buyEntries posts a complete-set buy: d USDC mints d YES + d NO; the pool keeps the opposite
// side and pays the bought outcome out of its reserve.
func buyEntries(userID, marketID uuid.UUID, outcome string, deposit, sharesOut decimal.Decimal) []ledgerEntry {
	other := oppositeOutcome(outcome)
	return []ledgerEntry{
		{&userID, &marketID, acctUserCash, assetUSDC, deposit.Neg()},
		{&userID, &marketID, acctPoolCollateral, assetUSDC, deposit},
		{&userID, &marketID, acctOutcomeSupply, outcome, deposit.Neg()},
		{&userID, &marketID, acctOutcomeSupply, other, deposit.Neg()},
		{&userID, &marketID, acctPoolReserve, outcome, deposit.Sub(sharesOut)},
		{&userID, &marketID, acctPoolReserve, other, deposit},
		{&userID, &marketID, positionAccount(outcome), outcome, sharesOut},
	}
}

// sellEntries posts a complete-set sell: the user returns s shares, the pool burns p complete
// sets and pays p USDC from collateral.
func sellEntries(userID, marketID uuid.UUID, outcome string, sharesIn, payout decimal.Decimal) []ledgerEntry {
	other := oppositeOutcome(outcome)
	return []ledgerEntry{
		{&userID, &marketID, acctPoolCollateral, assetUSDC, payout.Neg()},
		{&userID, &marketID, acctUserCash, assetUSDC, payout},
		{&userID, &marketID, positionAccount(outcome), outcome, sharesIn.Neg()},
		{&userID, &marketID, acctPoolReserve, outcome, sharesIn.Sub(payout)},
		{&userID, &marketID, acctPoolReserve, other, payout.Neg()},
		{&userID, &marketID, acctOutcomeSupply, outcome, payout},
		{&userID, &marketID, acctOutcomeSupply, other, payout},
	}
}

// marketSeedEntries posts a new market's collateral from the treasury. Collateral C mints C
// complete sets; the pool's virtual reserves hold reserveYes / reserveNo of them and the rest
// is pool inventory, so reserves can be rebuilt from the ledger.
func marketSeedEntries(marketID uuid.UUID, collateral, reserveYes, reserveNo decimal.Decimal) []ledgerEntry {
	return []ledgerEntry{
		{nil, &marketID, acctSystemTreasury, assetUSDC, collateral.Neg()},
		{nil, &marketID, acctPoolCollateral, assetUSDC, collateral},
		{nil, &marketID, acctOutcomeSupply, string(amm.OutcomeYES), collateral.Neg()},
		{nil, &marketID, acctOutcomeSupply, string(amm.OutcomeNO), collateral.Neg()},
		{nil, &marketID, acctPoolReserve, string(amm.OutcomeYES), reserveYes},
		{nil, &marketID, acctPoolReserve, string(amm.OutcomeNO), reserveNo},
		{nil, &marketID, acctPoolInventory, string(amm.OutcomeYES), collateral.Sub(reserveYes)},
		{nil, &marketID, acctPoolInventory, string(amm.OutcomeNO), collateral.Sub(reserveNo)},
	}
}

// treasuryGrantEntries posts USDC from the treasury to a user (starting balance or claim).
func treasuryGrantEntries(userID uuid.UUID, amount decimal.Decimal) []ledgerEntry {
	return []ledgerEntry{
		{nil, nil, acctSystemTreasury, assetUSDC, amount.Neg()},
		{&userID, nil, acctUserCash, assetUSDC, amount},
	}
}

func oppositeOutcome(outcome string) string {
	if outcome == string(amm.OutcomeYES) {
		return string(amm.OutcomeNO)
	}
	return string(amm.OutcomeYES)
}

// insertSeededUser runs a user INSERT ... RETURNING id, ... and posts the starting balance from the
// treasury in the same transaction. The first scan destination must be the new user's ID.
func insertSeededUser(ctx context.Context, pool *pgxpool.Pool, insert func(pgx.Tx) pgx.Row, seed decimal.Decimal, dest ...any) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := insert(tx).Scan(dest...); err != nil {
		return err
	}
	userID, ok := dest[0].(*uuid.UUID)
	if !ok {
		return fmt.Errorf("insertSeededUser: first scan destination must be *uuid.UUID")
	}

	ledgerSQL, ledgerArgs, err := buildLedgerInsert(uuid.New(), entryUserSeed, treasuryGrantEntries(*userID, seed))
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, ledgerSQL, ledgerArgs...); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// assertTransactionBalanced fails if the ledger rows written for txID do not net to zero per asset.
// Used after set-based postings that cannot go through buildLedgerInsert.
func assertTransactionBalanced(ctx context.Context, tx pgx.Tx, txID uuid.UUID) error {
	var asset string
	var sum decimal.Decimal
	err := tx.QueryRow(ctx, `
		SELECT asset, SUM(delta) FROM ledger_entries
		WHERE transaction_id = $1
		GROUP BY asset HAVING SUM(delta) <> 0
		LIMIT 1;
	`, txID).Scan(&asset, &sum)
	if err == nil {
		return fmt.Errorf("ledger: transaction %s unbalanced for %s by %s", txID, asset, sum.StringFixed(8))
	}
	if err == pgx.ErrNoRows {
		return nil
	}
	return err
}
