-- 000007_trade_price_history.down.sql
DROP INDEX IF EXISTS idx_trades_market_probability;
ALTER TABLE trades DROP COLUMN IF EXISTS yes_probability_after;
