-- 000009_idempotency_binding.up.sql
-- Idempotency keys are now bound to the request they were used for. The fingerprint is a SHA-256 of
-- the request's defining fields; a retry with a different fingerprint is refused with 422.
ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS request_hash VARCHAR(64);

-- A trade key is unique per user and trade type, so a BUY and a cash-out that happen to share a key
-- no longer collide. Replays of the same operation are still caught by the idempotency_keys primary key.
ALTER TABLE trades DROP CONSTRAINT IF EXISTS uq_trades_user_idempotency;
ALTER TABLE trades ADD CONSTRAINT uq_trades_user_idempotency_type UNIQUE (user_id, idempotency_key, trade_type);
