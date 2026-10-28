-- 000007_trade_price_history.up.sql
-- Implied YES probability immediately after each trade, so the price chart is drawn from recorded
-- trades. Trades made before this migration have NULL here and do not appear in history.
ALTER TABLE trades ADD COLUMN IF NOT EXISTS yes_probability_after NUMERIC(10, 8);

CREATE INDEX IF NOT EXISTS idx_trades_market_probability
    ON trades(market_id, created_at)
    WHERE yes_probability_after IS NOT NULL;
