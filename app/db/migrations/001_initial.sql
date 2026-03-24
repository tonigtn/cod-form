-- Migration 001: Initial schema
-- Run with: psql -d cod_form -f app/db/migrations/001_initial.sql

BEGIN;

CREATE TABLE IF NOT EXISTS shops (
    id SERIAL PRIMARY KEY,
    shop_domain TEXT UNIQUE NOT NULL,
    access_token_encrypted TEXT,
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    uninstalled_at TIMESTAMPTZ,
    locale TEXT DEFAULT 'ro',
    country_code TEXT DEFAULT 'RO',
    currency TEXT DEFAULT 'RON',
    store_name TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS shop_configs (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
    section TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(shop_id, section)
);

CREATE TABLE IF NOT EXISTS product_configs (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    UNIQUE(shop_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
    shopify_order_id BIGINT,
    order_name TEXT,
    phone_hash TEXT,
    phone_last4 TEXT,
    city TEXT,
    province TEXT,
    zip TEXT,
    variant_id BIGINT,
    quantity INTEGER DEFAULT 1,
    total DECIMAL(10,2),
    currency TEXT,
    ip TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    product_id BIGINT,
    variant_id BIGINT,
    order_value DECIMAL(10,2),
    ip TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    extra JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blacklists (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(shop_id, type, value)
);

CREATE TABLE IF NOT EXISTS abandoned_forms (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    first_name TEXT,
    product_id BIGINT,
    variant_id BIGINT,
    unit_price DECIMAL(10,2),
    province TEXT,
    draft_gid TEXT,
    reminder_sent BOOLEAN DEFAULT FALSE,
    recovered BOOLEAN DEFAULT FALSE,
    recovered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(shop_id, phone)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_shop_created ON orders(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone_hash ON orders(shop_id, phone_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_shop_created ON events(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_shop_type ON events(shop_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blacklists_shop_type ON blacklists(shop_id, type);
CREATE INDEX IF NOT EXISTS idx_abandoned_shop ON abandoned_forms(shop_id, recovered, reminder_sent);
CREATE INDEX IF NOT EXISTS idx_shop_configs_shop ON shop_configs(shop_id);

COMMIT;
