-- COD Form App — PostgreSQL Schema
-- Run this to initialize the database, or use Alembic migrations.

-- Stores (one per Shopify install)
CREATE TABLE IF NOT EXISTS shops (
    id SERIAL PRIMARY KEY,
    shop_domain TEXT UNIQUE NOT NULL,      -- rmeai1-da.myshopify.com
    access_token_encrypted TEXT,           -- Fernet encrypted
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    uninstalled_at TIMESTAMPTZ,
    locale TEXT DEFAULT 'ro',              -- ro, el, en
    country_code TEXT DEFAULT 'RO',
    currency TEXT DEFAULT 'RON',
    store_name TEXT DEFAULT ''
);

-- Store config (replaces JSON files)
CREATE TABLE IF NOT EXISTS shop_configs (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
    section TEXT NOT NULL,                 -- 'form', 'shipping', 'upsells', etc.
    config JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(shop_id, section)
);

-- Per-product overrides
CREATE TABLE IF NOT EXISTS product_configs (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    UNIQUE(shop_id, product_id)
);

-- Orders log (for fraud detection + admin analytics)
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

-- Events (form opens, closes, conversions)
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

-- Blacklists
CREATE TABLE IF NOT EXISTS blacklists (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
    type TEXT NOT NULL,                    -- 'phone' or 'ip'
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(shop_id, type, value)
);

-- Abandoned form captures
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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_shop_created ON orders(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone_hash ON orders(shop_id, phone_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_shop_created ON events(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_shop_type ON events(shop_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blacklists_shop_type ON blacklists(shop_id, type);
CREATE INDEX IF NOT EXISTS idx_abandoned_shop ON abandoned_forms(shop_id, recovered, reminder_sent);
CREATE INDEX IF NOT EXISTS idx_shop_configs_shop ON shop_configs(shop_id);
