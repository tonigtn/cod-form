"""Migrate existing stores from ai-agents into the cod-form PostgreSQL database.

Reads tokens from:
1. Old encrypted token store (data/cod/store_tokens.json) for OAuth-installed shops
2. Direct env vars (STORE_X_SHOPIFY_ACCESS_TOKEN) for custom app installs

Also migrates existing JSON configs into shop_configs table.

Usage: cd ~/cod-form && set -a && . .env && set +a && uv run python scripts/migrate_stores.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

import asyncpg
from cryptography.fernet import Fernet

# Shop metadata
SHOPS = [
    {
        "shop_domain": "rmeai1-da.myshopify.com",
        "store_name": "PrietenBebe",
        "locale": "ro",
        "country_code": "RO",
        "currency": "RON",
        "env_token_key": "STORE_1_SHOPIFY_ACCESS_TOKEN",
        "old_store_id": "store_1",
    },
    {
        "shop_domain": "10qaxg-sc.myshopify.com",
        "store_name": "AirForm",
        "locale": "ro",
        "country_code": "RO",
        "currency": "RON",
        "env_token_key": "STORE_2_SHOPIFY_ACCESS_TOKEN",
        "old_store_id": "store_2",
    },
    {
        "shop_domain": "wst6jx-73.myshopify.com",
        "store_name": "MagazinulTării",
        "locale": "ro",
        "country_code": "RO",
        "currency": "RON",
        "env_token_key": "STORE_3_SHOPIFY_ACCESS_TOKEN",
        "old_store_id": "store_3",
    },
    {
        "shop_domain": "jgj1ff-ak.myshopify.com",
        "store_name": "BebeMate",
        "locale": "el",
        "country_code": "GR",
        "currency": "EUR",
        "env_token_key": "STORE_4_SHOPIFY_ACCESS_TOKEN",
        "old_store_id": "store_4",
    },
]


def get_fernet() -> Fernet:
    key = os.environ.get("FERNET_KEY", "")
    if not key:
        print("ERROR: FERNET_KEY not set")
        sys.exit(1)
    return Fernet(key.encode())


def get_token_for_shop(shop: dict[str, str], fernet: Fernet) -> str | None:
    """Get access token from env var or old token store."""
    # Try direct env var first
    token = os.environ.get(shop["env_token_key"], "")
    if token:
        return token

    # Try old encrypted token store
    old_tokens_path = Path.home() / "ai-agents" / "data" / "cod" / "store_tokens.json"
    if old_tokens_path.exists():
        try:
            raw = json.loads(old_tokens_path.read_bytes())
            encrypted = raw.get(shop["shop_domain"])
            if encrypted:
                # Old store uses the same Fernet key (COD_APP_FERNET_KEY = FERNET_KEY)
                return fernet.decrypt(encrypted.encode()).decode()
        except Exception as e:
            print(f"  Warning: Could not decrypt old token for {shop['shop_domain']}: {e}")

    return None


def load_old_config(store_id: str) -> dict[str, object] | None:
    """Load old JSON config for a store from ai-agents."""
    config_path = Path.home() / "ai-agents" / "data" / "cod" / f"config_{store_id}.json"
    if not config_path.exists():
        return None
    try:
        return json.loads(config_path.read_bytes())
    except Exception as e:
        print(f"  Warning: Could not load config for {store_id}: {e}")
        return None


async def migrate() -> None:
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    fernet = get_fernet()
    conn = await asyncpg.connect(db_url)

    try:
        for shop in SHOPS:
            domain = shop["shop_domain"]
            print(f"\n--- Migrating {shop['store_name']} ({domain}) ---")

            # Get access token
            token = get_token_for_shop(shop, fernet)
            encrypted_token = fernet.encrypt(token.encode()).decode() if token else None

            if not token:
                print(f"  No token found, inserting without token")
            else:
                print(f"  Token found ({len(token)} chars)")

            # Upsert shop
            await conn.execute(
                """
                INSERT INTO shops (shop_domain, access_token_encrypted, store_name, locale, country_code, currency)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (shop_domain) DO UPDATE SET
                    access_token_encrypted = COALESCE($2, shops.access_token_encrypted),
                    store_name = $3, locale = $4, country_code = $5, currency = $6
                """,
                domain, encrypted_token, shop["store_name"],
                shop["locale"], shop["country_code"], shop["currency"],
            )

            # Get the shop_id
            shop_id = await conn.fetchval(
                "SELECT id FROM shops WHERE shop_domain = $1", domain
            )
            print(f"  Shop ID: {shop_id}")

            # Migrate config sections
            old_config = load_old_config(shop["old_store_id"])
            if old_config:
                sections_migrated = 0
                for section, data in old_config.items():
                    if isinstance(data, (dict, list)):
                        json_str = json.dumps(data)
                        await conn.execute(
                            """
                            INSERT INTO shop_configs (shop_id, section, config)
                            VALUES ($1, $2, $3::jsonb)
                            ON CONFLICT (shop_id, section) DO UPDATE SET config = $3::jsonb, updated_at = NOW()
                            """,
                            shop_id, section, json_str,
                        )
                        sections_migrated += 1
                print(f"  Migrated {sections_migrated} config sections")
            else:
                print(f"  No old config found for {shop['old_store_id']}")

        # Summary
        count = await conn.fetchval("SELECT COUNT(*) FROM shops")
        config_count = await conn.fetchval("SELECT COUNT(*) FROM shop_configs")
        print(f"\n=== Done: {count} shops, {config_count} config sections ===")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(migrate())
