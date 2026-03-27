"""Fraud detection — DB-backed blacklists and duplicate detection."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta

import structlog

from app.db import pool
from app.schemas import CodOrderRequest, FraudResult
from app.services.store_config import CodFraudConfig, load_store_config

log = structlog.get_logger(__name__)


def _normalize_phone(phone: str) -> str:
    return phone.replace(" ", "").replace("-", "")


def _hash_phone(phone: str) -> str:
    return hashlib.sha256(phone.encode()).hexdigest()[:16]


async def check_fraud(req: CodOrderRequest, ip: str, shop_id: int) -> FraudResult:
    """Run all fraud checks. Returns FraudResult(passed=False) if blocked."""
    config: CodFraudConfig = (await load_store_config(shop_id)).fraud
    phone = _normalize_phone(req.phone)

    # 1. Phone blacklist (DB + per-store config)
    db_phones = await _load_blacklist(shop_id, "phone")
    if phone in db_phones or phone in config.blocked_phones:
        log.warning("cod_fraud_phone_blocked", shop=req.shop, phone_last4=phone[-4:])
        return FraudResult(passed=False, reason="Numărul de telefon este blocat.")

    # 2. IP blacklist
    db_ips = await _load_blacklist(shop_id, "ip")
    if ip in db_ips or ip in config.blocked_ips:
        log.warning("cod_fraud_ip_blocked", shop=req.shop, ip=ip)
        return FraudResult(passed=False, reason="Acces blocat.")

    # 3. Blocked postal codes
    if req.zip and req.zip in config.blocked_postal_codes:
        return FraudResult(
            passed=False,
            reason="Livrarea nu este disponibilă în această zonă.",
        )

    # 4. Duplicate phone within window
    if await _check_duplicate_phone(phone, shop_id, config):
        return FraudResult(
            passed=False,
            reason="Comandă duplicat detectată. Încercați mai târziu.",
        )

    return FraudResult(passed=True)


async def log_order(
    req: CodOrderRequest,
    ip: str,
    order_name: str,
    order_id: int,
    shop_id: int,
) -> None:
    """Log order to DB for fraud analysis."""
    phone = _normalize_phone(req.phone)
    try:
        await pool.execute(
            """
            INSERT INTO orders (shop_id, shopify_order_id, order_name, phone_hash, phone_last4,
                                city, province, zip, variant_id, quantity, ip)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            """,
            shop_id,
            order_id,
            order_name,
            _hash_phone(phone),
            phone[-4:],
            req.city,
            req.province,
            req.zip,
            req.variant_id,
            req.quantity,
            ip,
        )
    except Exception as exc:
        log.error("cod_order_log_error", error=str(exc))


async def _load_blacklist(shop_id: int, bl_type: str) -> set[str]:
    """Load blacklist entries from DB."""
    rows = await pool.fetch(
        "SELECT value FROM blacklists WHERE shop_id = $1 AND type = $2",
        shop_id,
        bl_type,
    )
    return {r["value"] for r in rows}


async def _check_duplicate_phone(phone: str, shop_id: int, config: CodFraudConfig) -> bool:
    """Check if same phone placed an order within the window.

    Uses pg_advisory_xact_lock to serialize concurrent requests for the same phone,
    preventing race conditions where 3 simultaneous clicks all pass the check.
    """
    if config.duplicate_window_minutes > 0:
        delta = timedelta(minutes=config.duplicate_window_minutes)
    elif config.duplicate_window_hours > 0:
        delta = timedelta(hours=config.duplicate_window_hours)
    else:
        return False

    cutoff = datetime.now(tz=UTC) - delta
    phone_hash = _hash_phone(phone)

    # Use advisory lock keyed on shop_id + phone_hash to serialize concurrent submissions
    lock_key = hash((shop_id, phone_hash)) & 0x7FFFFFFFFFFFFFFF  # positive int64
    db = pool.get_pool()
    async with db.acquire() as conn, conn.transaction():
        await conn.execute("SELECT pg_advisory_xact_lock($1)", lock_key)
        count = await conn.fetchval(
            """
                SELECT COUNT(*) FROM orders
                WHERE shop_id = $1 AND phone_hash = $2 AND created_at > $3
                """,
            shop_id,
            phone_hash,
            cutoff,
        )
        return bool(count and count > 0)
