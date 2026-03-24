"""DB-backed encrypted token storage — replaces file-based token_store.py."""

from __future__ import annotations

import structlog
from cryptography.fernet import Fernet, InvalidToken

from app.config import get_fernet_key
from app.db import pool

log = structlog.get_logger(__name__)

# In-memory cache: {shop_domain: access_token}
_token_cache: dict[str, str] = {}


def _get_fernet() -> Fernet:
    """Get Fernet cipher instance."""
    key = get_fernet_key()
    if not key:
        msg = "FERNET_KEY not set — cannot encrypt/decrypt tokens"
        raise RuntimeError(msg)
    return Fernet(key.encode())


async def store_token(shop: str, access_token: str) -> None:
    """Encrypt and store an access token for a shop."""
    fernet = _get_fernet()
    encrypted = fernet.encrypt(access_token.encode()).decode()

    await pool.execute(
        """
        INSERT INTO shops (shop_domain, access_token_encrypted)
        VALUES ($1, $2)
        ON CONFLICT (shop_domain) DO UPDATE
        SET access_token_encrypted = $2, uninstalled_at = NULL
        """,
        shop,
        encrypted,
    )
    _token_cache[shop] = access_token
    log.info("token_stored", shop=shop)


async def get_token(shop: str) -> str | None:
    """Retrieve and decrypt an access token. Returns None if not found."""
    if shop in _token_cache:
        return _token_cache[shop]

    row = await pool.fetchrow(
        "SELECT access_token_encrypted FROM shops WHERE shop_domain = $1",
        shop,
    )
    if not row or not row["access_token_encrypted"]:
        return None

    try:
        fernet = _get_fernet()
        decrypted = fernet.decrypt(row["access_token_encrypted"].encode()).decode()
        _token_cache[shop] = decrypted
        return decrypted
    except InvalidToken:
        log.error("token_decrypt_failed", shop=shop)
        return None


async def get_token_or_raise(shop: str) -> str:
    """Get token, raising ValueError if not found."""
    token = await get_token(shop)
    if not token:
        msg = f"No access token for shop: {shop}"
        raise ValueError(msg)
    return token


def invalidate_token(shop: str) -> None:
    """Clear cached token so next get_token() reads from DB."""
    _token_cache.pop(shop, None)


async def get_shop_id(shop: str) -> int | None:
    """Get the internal shop ID for a domain."""
    return await pool.fetchval("SELECT id FROM shops WHERE shop_domain = $1", shop)


async def get_shop_id_or_raise(shop: str) -> int:
    """Get shop ID, raising ValueError if not found."""
    shop_id = await get_shop_id(shop)
    if shop_id is None:
        msg = f"Shop not installed: {shop}"
        raise ValueError(msg)
    return shop_id


async def get_shop_info(shop: str) -> dict[str, str] | None:
    """Get shop info (locale, currency, country, name)."""
    row = await pool.fetchrow(
        """SELECT shop_domain, locale, country_code, currency, store_name
           FROM shops WHERE shop_domain = $1""",
        shop,
    )
    if not row:
        return None
    return {
        "shop_domain": row["shop_domain"],
        "locale": row["locale"] or "ro",
        "country_code": row["country_code"] or "RO",
        "currency": row["currency"] or "RON",
        "store_name": row["store_name"] or shop,
    }


async def update_shop_info(
    shop: str,
    *,
    locale: str = "",
    country_code: str = "",
    currency: str = "",
    store_name: str = "",
) -> None:
    """Update shop metadata."""
    parts: list[str] = []
    args: list[str] = []
    idx = 1

    if locale:
        idx += 1
        parts.append(f"locale = ${idx}")
        args.append(locale)
    if country_code:
        idx += 1
        parts.append(f"country_code = ${idx}")
        args.append(country_code)
    if currency:
        idx += 1
        parts.append(f"currency = ${idx}")
        args.append(currency)
    if store_name:
        idx += 1
        parts.append(f"store_name = ${idx}")
        args.append(store_name)

    if not parts:
        return

    query = f"UPDATE shops SET {', '.join(parts)} WHERE shop_domain = $1"
    await pool.execute(query, shop, *args)


async def list_shops() -> list[dict[str, str]]:
    """Return all installed shops."""
    rows = await pool.fetch(
        """SELECT shop_domain, store_name, locale, currency
           FROM shops WHERE uninstalled_at IS NULL ORDER BY installed_at"""
    )
    return [
        {
            "shop_domain": r["shop_domain"],
            "store_name": r["store_name"] or r["shop_domain"],
            "locale": r["locale"] or "ro",
            "currency": r["currency"] or "RON",
        }
        for r in rows
    ]
