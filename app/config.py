"""Application configuration — loads from environment variables."""

from __future__ import annotations

import os
from functools import lru_cache


@lru_cache(maxsize=1)
def get_database_url() -> str:
    """PostgreSQL connection URL."""
    return os.environ.get(
        "DATABASE_URL", "postgresql://cod_form_user:password@localhost:5432/cod_form"
    )


@lru_cache(maxsize=1)
def get_client_id() -> str:
    """Primary Shopify app client ID."""
    return os.environ.get("SHOPIFY_CLIENT_ID", "")


@lru_cache(maxsize=1)
def get_client_secret() -> str:
    """Primary Shopify app client secret."""
    return os.environ.get("SHOPIFY_CLIENT_SECRET", "")


@lru_cache(maxsize=1)
def get_all_app_credentials() -> list[tuple[str, str]]:
    """Return all registered app (client_id, client_secret) pairs.

    Scans env vars: SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET (primary),
    SHOPIFY_CLIENT_ID_2 / SHOPIFY_CLIENT_SECRET_2, etc.
    """
    creds: list[tuple[str, str]] = []
    cid = os.environ.get("SHOPIFY_CLIENT_ID", "")
    secret = os.environ.get("SHOPIFY_CLIENT_SECRET", "")
    if cid and secret:
        creds.append((cid, secret))
    for i in range(2, 10):
        cid = os.environ.get(f"SHOPIFY_CLIENT_ID_{i}", "")
        secret = os.environ.get(f"SHOPIFY_CLIENT_SECRET_{i}", "")
        if cid and secret:
            creds.append((cid, secret))
    return creds


@lru_cache(maxsize=1)
def get_fernet_key() -> str:
    """Fernet key for encrypting stored access tokens."""
    return os.environ.get("FERNET_KEY", "")


@lru_cache(maxsize=1)
def get_app_base_url() -> str:
    """Public HTTPS base URL for this app."""
    return os.environ.get("APP_BASE_URL", "https://localhost:8004")


@lru_cache(maxsize=1)
def get_api_key() -> str:
    """API key for direct (non-proxy) storefront access."""
    return os.environ.get("COD_API_KEY", "")


# OAuth scopes required by this app
REQUIRED_SCOPES = ",".join(
    [
        "read_products",
        "write_products",
        "read_orders",
        "write_orders",
        "write_draft_orders",
        "read_customers",
        "write_customers",
        "read_inventory",
        "read_shipping",
        "read_discounts",
        "write_discounts",
        "read_themes",
        "write_themes",
        "read_content",
        "read_locales",
        "read_markets",
    ]
)
