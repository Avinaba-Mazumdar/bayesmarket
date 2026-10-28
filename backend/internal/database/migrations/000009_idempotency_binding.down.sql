-- 000009_idempotency_binding.down.sql
ALTER TABLE trades DROP CONSTRAINT IF EXISTS uq_trades_user_idempotency_type;
ALTER TABLE trades ADD CONSTRAINT uq_trades_user_idempotency UNIQUE (user_id, idempotency_key);
ALTER TABLE idempotency_keys DROP COLUMN IF EXISTS request_hash;
