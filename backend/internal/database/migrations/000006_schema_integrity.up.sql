-- 000006_schema_integrity.up.sql

-- Refuse to migrate a ledger written under the old accounting model. Those rows cannot be reconciled:
-- they use accounts the code no longer writes, or transactions whose deltas do not net to zero per
-- asset. Reset the database instead of migrating it.
DO $$
DECLARE
    legacy_account TEXT;
    unbalanced_txn UUID;
BEGIN
    SELECT account INTO legacy_account
    FROM ledger_entries
    WHERE account NOT IN ('user_cash', 'pool_collateral', 'system_treasury', 'pool_reserve', 'pool_inventory', 'outcome_supply')
    LIMIT 1;
    IF legacy_account IS NOT NULL THEN
        RAISE EXCEPTION 'ledger_entries holds legacy account "%": reset the database instead of migrating it', legacy_account;
    END IF;

    SELECT transaction_id INTO unbalanced_txn
    FROM ledger_entries
    GROUP BY transaction_id, asset
    HAVING SUM(delta) <> 0
    LIMIT 1;
    IF unbalanced_txn IS NOT NULL THEN
        RAISE EXCEPTION 'ledger transaction % does not net to zero: reset the database instead of migrating it', unbalanced_txn;
    END IF;
END $$;
-- lock_version was incremented on every trade but never read: concurrency is enforced with
-- pessimistic row locks (SELECT ... FOR UPDATE), so the column is removed.
ALTER TABLE liquidity_pools DROP COLUMN IF EXISTS lock_version;

-- k_invariant was written at creation and never updated. The application now maintains it on
-- every reserve change; backfill the current product for existing pools.
UPDATE liquidity_pools SET k_invariant = reserve_yes * reserve_no;

-- Enumerated columns. NOT VALID enforces the rule for every new or updated row without failing
-- the migration on historical rows; run ALTER TABLE ... VALIDATE CONSTRAINT after checking them.
ALTER TABLE markets ADD CONSTRAINT chk_markets_status
    CHECK (status IN ('draft', 'active', 'suspended', 'locked', 'resolved', 'settled', 'voided')) NOT VALID;
ALTER TABLE markets ADD CONSTRAINT chk_markets_winning_outcome
    CHECK (winning_outcome IS NULL OR winning_outcome IN ('YES', 'NO')) NOT VALID;
ALTER TABLE user_positions ADD CONSTRAINT chk_positions_outcome
    CHECK (outcome IN ('YES', 'NO')) NOT VALID;
ALTER TABLE trades ADD CONSTRAINT chk_trades_trade_type
    CHECK (trade_type IN ('BUY', 'SELL')) NOT VALID;
ALTER TABLE trades ADD CONSTRAINT chk_trades_outcome
    CHECK (outcome IN ('YES', 'NO')) NOT VALID;
ALTER TABLE ledger_entries ADD CONSTRAINT chk_ledger_asset
    CHECK (asset IN ('USDC', 'YES', 'NO')) NOT VALID;
