-- Migration 003: Add billing fields to shops table

ALTER TABLE shops ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS app_subscription_id TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
