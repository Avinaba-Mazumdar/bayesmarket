-- ==============================================================================
-- BayesMarket - Least-Privilege Application User Provisioning Script
-- ==============================================================================
-- Target: Neon Serverless PostgreSQL / Cloud PostgreSQL
-- Purpose:
--   Creates a dedicated, unprivileged runtime database role ('bayes_app') for the
--   BayesMarket Go API server.
--
-- Security Guarantees:
--   1. Permitted DML: SELECT and INSERT on application tables; UPDATE only on mutable tables and on the
--      users columns the API writes (never is_admin).
--   2. Permitted Sequence Usage: USAGE, SELECT on sequence generators.
--   3. PROHIBITED: DROP, TRUNCATE, ALTER, CREATE TABLE, DELETE, and any UPDATE on ledger_entries or trades.
--
-- Instructions:
--   1. Run this script in the Neon SQL Editor or via psql as the database owner ('neondb_owner').
--   2. Replace 'GENERATE_A_STRONG_DB_PASSWORD' with a secure random secret.
--   3. Update your production server's DATABASE_URL:
--      postgres://bayes_app:GENERATE_A_STRONG_DB_PASSWORD@ep-xxx.us-east-2.aws.neon.tech/bayesmarket?sslmode=require
-- ==============================================================================

\set ON_ERROR_STOP on

-- 1. Create the runtime application role if not already created
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'bayes_app') THEN
        CREATE ROLE bayes_app WITH LOGIN PASSWORD 'GENERATE_A_STRONG_DB_PASSWORD';
    ELSE
        ALTER ROLE bayes_app WITH LOGIN PASSWORD 'GENERATE_A_STRONG_DB_PASSWORD';
    END IF;
END
$$;

-- 2. Grant connection and schema traversal rights
GRANT CONNECT ON DATABASE bayesmarket TO bayes_app;
GRANT USAGE ON SCHEMA public TO bayes_app;

-- 3. Explicitly revoke DDL creation rights on schema public
REVOKE CREATE ON SCHEMA public FROM bayes_app;

-- 4. Grant SELECT and INSERT on all current tables. UPDATE is granted only where the API needs it.
--    The revoke comes first so that re-running this script on an older install removes the broad UPDATE.
REVOKE UPDATE ON ALL TABLES IN SCHEMA public FROM bayes_app;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO bayes_app;

-- 5. Explicitly revoke destructive privileges on all tables
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM bayes_app;

-- 5a. Mutable tables. ledger_entries, trades, idempotency_keys and schema_migrations are append-only for the
--     runtime role: no UPDATE is granted, so history cannot be rewritten through the application account.
GRANT UPDATE ON markets, liquidity_pools, user_positions, refresh_tokens, faucet_claims TO bayes_app;

-- 5b. users: only the columns the API writes. is_admin is never updated by the application, so this role
--     cannot grant admin, even through a future SQL bug. Admin status is changed by the database owner only.
GRANT UPDATE (cash_balance, last_active, email, name, avatar_url, google_id, ip_address, auth_provider, is_guest)
    ON users TO bayes_app;

-- 6. Grant sequence access (for serials / identity sequences)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bayes_app;

-- 7. Future tables get SELECT and INSERT by default. A migration that needs UPDATE must grant it explicitly.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT ON TABLES TO bayes_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT USAGE, SELECT ON SEQUENCES TO bayes_app;

-- 8. Verify assigned permissions
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'bayes_app'
ORDER BY table_name, privilege_type;
