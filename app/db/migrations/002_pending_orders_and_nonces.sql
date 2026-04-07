-- Migration 002: Add pending_orders table (fraud duplicate detection)
-- and nonces table (persistent OAuth CSRF protection)

CREATE TABLE IF NOT EXISTS pending_orders (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
    phone_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(shop_id, phone_hash)
);

CREATE TABLE IF NOT EXISTS nonces (
    nonce TEXT PRIMARY KEY,
    shop TEXT NOT NULL,
    client_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-cleanup old nonces (> 10 minutes) and pending orders (> 1 hour)
-- Run periodically via scheduled task or on each nonce check
