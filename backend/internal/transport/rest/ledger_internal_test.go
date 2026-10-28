package rest

import (
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

func sumByAsset(entries []ledgerEntry) map[string]decimal.Decimal {
	sums := map[string]decimal.Decimal{}
	for _, e := range entries {
		sums[e.asset] = sums[e.asset].Add(e.delta)
	}
	return sums
}

// Every posting template must net to zero per asset for any amounts.
func TestLedgerTemplatesBalance(t *testing.T) {
	user, market := uuid.New(), uuid.New()
	d := decimal.RequireFromString("123.45678901")
	shares := decimal.RequireFromString("187.65432109")
	cases := map[string][]ledgerEntry{
		"buy YES":     buyEntries(user, market, "YES", d, shares),
		"buy NO":      buyEntries(user, market, "NO", d, shares),
		"sell YES":    sellEntries(user, market, "YES", shares, d),
		"sell NO":     sellEntries(user, market, "NO", shares, d),
		"market seed": marketSeedEntries(market, decimal.NewFromInt(10000), decimal.RequireFromString("3200"), decimal.RequireFromString("6800")),
		"grant":       treasuryGrantEntries(user, decimal.NewFromInt(1000)),
	}
	for name, entries := range cases {
		for asset, sum := range sumByAsset(entries) {
			if !sum.IsZero() {
				t.Errorf("%s: %s does not balance: %s", name, asset, sum)
			}
		}
		if _, _, err := buildLedgerInsert(uuid.New(), entryTrade, entries); err != nil {
			t.Errorf("%s: buildLedgerInsert rejected a balanced posting: %v", name, err)
		}
	}
}

// Reserve and position deltas must equal what the AMM writes to the pool and position rows.
func TestBuySellEntriesMirrorSnapshots(t *testing.T) {
	user, market := uuid.New(), uuid.New()
	d := decimal.RequireFromString("50")
	shares := decimal.RequireFromString("72.5")
	got := map[string]decimal.Decimal{}
	for _, e := range buyEntries(user, market, "YES", d, shares) {
		got[e.account+"/"+e.asset] = got[e.account+"/"+e.asset].Add(e.delta)
	}
	// R_yes' = R_yes + d - shares, R_no' = R_no + d, position += shares, collateral += d
	want := map[string]string{
		"pool_reserve/YES":     "-22.5",
		"pool_reserve/NO":      "50",
		"position_yes/YES":     "72.5",
		"pool_collateral/USDC": "50",
		"user_cash/USDC":       "-50",
	}
	for key, w := range want {
		if !got[key].Equal(decimal.RequireFromString(w)) {
			t.Errorf("buy %s: want %s, got %s", key, w, got[key])
		}
	}
}

func TestBuildLedgerInsertRejectsBadPostings(t *testing.T) {
	user := uuid.New()
	unbalanced := []ledgerEntry{{&user, nil, acctUserCash, assetUSDC, decimal.NewFromInt(5)}}
	if _, _, err := buildLedgerInsert(uuid.New(), entryClaim, unbalanced); err == nil || !strings.Contains(err.Error(), "unbalanced") {
		t.Errorf("expected unbalanced posting to be rejected, got %v", err)
	}

	tooPrecise := treasuryGrantEntries(user, decimal.RequireFromString("1.000000001"))
	if _, _, err := buildLedgerInsert(uuid.New(), entryClaim, tooPrecise); err == nil {
		t.Error("expected posting beyond 8 decimal places to be rejected")
	}

	if _, _, err := buildLedgerInsert(uuid.New(), entryClaim, nil); err == nil {
		t.Error("expected empty posting to be rejected")
	}
}

func TestBuildLedgerInsertSQL(t *testing.T) {
	user := uuid.New()
	query, args, err := buildLedgerInsert(uuid.New(), entryClaim, treasuryGrantEntries(user, decimal.NewFromInt(100)))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Count(query, "($1, ") != 2 {
		t.Errorf("expected 2 value rows, got query %s", query)
	}
	// txID, entry type, then 5 params per row
	if len(args) != 2+2*5 {
		t.Errorf("expected 12 args, got %d", len(args))
	}
}
