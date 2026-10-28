-- 000006_schema_integrity.up.sql
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
