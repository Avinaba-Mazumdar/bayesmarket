-- 000006_schema_integrity.down.sql
ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS chk_ledger_asset;
ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_outcome;
ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_trade_type;
ALTER TABLE user_positions DROP CONSTRAINT IF EXISTS chk_positions_outcome;
ALTER TABLE markets DROP CONSTRAINT IF EXISTS chk_markets_winning_outcome;
ALTER TABLE markets DROP CONSTRAINT IF EXISTS chk_markets_status;

ALTER TABLE liquidity_pools ADD COLUMN IF NOT EXISTS lock_version INT NOT NULL DEFAULT 0;
