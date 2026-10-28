-- 000001_core_schema.up.sql
-- The complete BayesMarket schema in one migration. It replaces the earlier incremental migrations
-- (000001 to 000010), which were never applied to a production database. Apply it to an empty database.
--
-- The migration runner applies this file and records version 1. Running this file by hand, for example
-- in the Neon SQL editor, also records version 1, so the runner does not apply it a second time.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Migration tracking table. The DDL matches internal/database/migrations.go, so a manual run and a
-- runner run record versions in the same place.
CREATE TABLE IF NOT EXISTS schema_migrations (
    version BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 1. USERS
-- is_admin is the only admin authority. The API reads it from this table on every admin request.
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_guest BOOLEAN NOT NULL DEFAULT true,
    auth_provider VARCHAR(32) NOT NULL DEFAULT 'guest',
    email VARCHAR(255) UNIQUE,
    name VARCHAR(255),
    avatar_url VARCHAR(512),
    google_id VARCHAR(255) UNIQUE,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    cash_balance NUMERIC(28, 8) NOT NULL DEFAULT 1000.00000000,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_positive_balance CHECK (cash_balance >= 0)
);

-- 2. PREDICTION MARKETS
-- image_url is not part of the schema: market cards do not render images.
CREATE TABLE IF NOT EXISTS markets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(128) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(64) NOT NULL,
    resolution_source TEXT NOT NULL,
    resolution_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    winning_outcome VARCHAR(8),
    -- Resolution evidence, set in the settlement transaction. The proof is the https link the admin supplied;
    -- the digest and hash commit to it, so the evidence stays checkable after the idempotency receipt expires.
    oracle_proof TEXT,
    proof_hash VARCHAR(64),
    settlement_digest VARCHAR(64),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_markets_status
        CHECK (status IN ('draft', 'active', 'suspended', 'locked', 'resolved', 'settled', 'voided')),
    CONSTRAINT chk_markets_winning_outcome
        CHECK (winning_outcome IS NULL OR winning_outcome IN ('YES', 'NO'))
);

-- 3. LIQUIDITY POOLS (CPMM state: k = reserve_yes * reserve_no)
CREATE TABLE IF NOT EXISTS liquidity_pools (
    market_id UUID PRIMARY KEY REFERENCES markets(id) ON DELETE CASCADE,
    reserve_yes NUMERIC(28, 8) NOT NULL,
    reserve_no NUMERIC(28, 8) NOT NULL,
    collateral_reserve NUMERIC(28, 8) NOT NULL,
    k_invariant NUMERIC(56, 16) NOT NULL,
    total_volume_usdc NUMERIC(28, 8) NOT NULL DEFAULT 0.00000000,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_positive_reserves CHECK (reserve_yes > 0 AND reserve_no > 0),
    CONSTRAINT chk_nonnegative_collateral CHECK (collateral_reserve >= 0)
);

-- 4. USER OUTCOME POSITIONS
CREATE TABLE IF NOT EXISTS user_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    outcome VARCHAR(8) NOT NULL,
    shares_owned NUMERIC(28, 8) NOT NULL DEFAULT 0.00000000,
    avg_buy_price NUMERIC(28, 8) NOT NULL DEFAULT 0.00000000,
    total_invested_usdc NUMERIC(28, 8) NOT NULL DEFAULT 0.00000000,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_market_outcome UNIQUE (user_id, market_id, outcome),
    CONSTRAINT chk_positive_shares CHECK (shares_owned >= 0),
    CONSTRAINT chk_positions_outcome CHECK (outcome IN ('YES', 'NO'))
);

-- 5. TRADE AUDIT LOG AND PRICE HISTORY
-- yes_probability_after is the implied YES probability right after the trade. The price chart is drawn
-- from it. It is NULL only for rows written before this schema existed.
-- A trade key is unique per user and trade type: a BUY and a cash-out may share a key.
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(128) NOT NULL,
    trade_type VARCHAR(8) NOT NULL,
    outcome VARCHAR(8) NOT NULL,
    amount_usdc NUMERIC(28, 8) NOT NULL,
    shares_filled NUMERIC(28, 8) NOT NULL,
    execution_price NUMERIC(28, 8) NOT NULL,
    price_impact_pct NUMERIC(16, 8) NOT NULL,
    yes_probability_after NUMERIC(10, 8),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_trades_user_idempotency_type UNIQUE (user_id, idempotency_key, trade_type),
    CONSTRAINT chk_trades_trade_type CHECK (trade_type IN ('BUY', 'SELL')),
    CONSTRAINT chk_trades_outcome CHECK (outcome IN ('YES', 'NO'))
);

-- 6. IMMUTABLE DOUBLE-ENTRY LEDGER
-- Accounts: user_cash, pool_collateral, system_treasury, pool_reserve, pool_inventory, outcome_supply,
-- and position accounts per user. Every transaction's deltas net to zero per asset.
CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    market_id UUID REFERENCES markets(id) ON DELETE RESTRICT,
    account VARCHAR(32) NOT NULL,
    asset VARCHAR(8) NOT NULL,
    delta NUMERIC(28, 8) NOT NULL,
    entry_type VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_ledger_asset CHECK (asset IN ('USDC', 'YES', 'NO'))
);

-- 7. MUTATION IDEMPOTENCY RECEIPTS
-- request_hash is the SHA-256 fingerprint of the request. A key reused with a different request is refused.
CREATE TABLE IF NOT EXISTS idempotency_keys (
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    operation VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    response JSONB,
    request_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (actor_id, operation, idempotency_key)
);

-- 8. CLAIM ABUSE LEDGER (sandbox funds, rate-limited by IP)
CREATE TABLE IF NOT EXISTS faucet_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(45) NOT NULL,
    amount NUMERIC(28, 8) NOT NULL DEFAULT 500.00000000,
    claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 9. REFRESH SESSIONS
-- Only a SHA-256 hash of the opaque token is stored. Rotation revokes the old row.
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = true;
CREATE INDEX IF NOT EXISTS idx_markets_status_category ON markets(status, category);
CREATE INDEX IF NOT EXISTS idx_positions_user ON user_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_market_created ON trades(market_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_market_probability
    ON trades(market_id, created_at)
    WHERE yes_probability_after IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_faucet_ip_time ON faucet_claims(ip_address, claimed_at DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- Record this version. ON CONFLICT lets the runner and a manual run both finish cleanly.
INSERT INTO schema_migrations (version, name, applied_at)
VALUES (1, '000001_core_schema.up.sql', NOW())
ON CONFLICT (version) DO NOTHING;
