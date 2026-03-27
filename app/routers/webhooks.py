"""Shopify webhook handlers — app lifecycle + GDPR mandatory endpoints."""

from __future__ import annotations

import hashlib
import hmac
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Request

from app.config import get_all_app_credentials
from app.db import pool
from app.shopify.tokens import invalidate_token

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


async def _verify_webhook_hmac(request: Request) -> bytes:
    """Verify Shopify webhook HMAC-SHA256 signature.

    Shopify signs the raw body with the app's client secret.
    The signature is in the X-Shopify-Hmac-Sha256 header (base64).
    We try all known secrets since webhooks can come from any installed app.

    Returns the raw body bytes on success, raises 401 on failure.
    """
    import base64

    received = request.headers.get("X-Shopify-Hmac-Sha256", "")
    if not received:
        raise HTTPException(status_code=401, detail="Missing HMAC header")

    body = await request.body()

    for _cid, secret in get_all_app_credentials():
        computed = base64.b64encode(
            hmac.new(secret.encode(), body, hashlib.sha256).digest()
        ).decode()
        if hmac.compare_digest(computed, received):
            return body

    log.warning("webhook_hmac_invalid")
    raise HTTPException(status_code=401, detail="Invalid HMAC signature")


# ── App Lifecycle ─────────────────────────────────────────────────────────


@router.post("/app-uninstalled")
async def app_uninstalled(request: Request) -> dict[str, bool]:
    """Handle app/uninstalled — mark shop as uninstalled, clear token."""
    body_bytes = await _verify_webhook_hmac(request)

    import orjson

    data: dict[str, Any] = orjson.loads(body_bytes)
    shop = str(data.get("myshopify_domain", "") or data.get("domain", ""))
    if not shop:
        log.warning("webhook_uninstall_no_shop", data_keys=list(data.keys()))
        return {"ok": False}

    # Clear in-memory cache
    invalidate_token(shop)

    # Mark uninstalled in DB (keep data for GDPR grace period)
    await pool.execute(
        "UPDATE shops SET uninstalled_at = NOW(), access_token_encrypted = NULL WHERE shop_domain = $1",
        shop,
    )

    log.info("webhook_app_uninstalled", shop=shop)
    return {"ok": True}


# ── GDPR Mandatory Webhooks ──────────────────────────────────────────────


@router.post("/customers-data-request")
async def customers_data_request(request: Request) -> dict[str, bool]:
    """Handle customers/data_request — report what data we hold for a customer.

    Shopify sends this when a customer requests their data under GDPR.
    We log the request. The merchant must provide the data export.
    Our stored data: phone_hash, phone_last4, city, province, zip in orders table.
    """
    body_bytes = await _verify_webhook_hmac(request)

    import orjson

    data: dict[str, Any] = orjson.loads(body_bytes)
    shop = str(data.get("shop_domain", ""))
    customer = data.get("customer", {})
    customer_id = customer.get("id", 0) if isinstance(customer, dict) else 0
    orders_requested = data.get("orders_requested", [])

    log.info(
        "webhook_customer_data_request",
        shop=shop,
        customer_id=customer_id,
        orders_count=len(orders_requested) if isinstance(orders_requested, list) else 0,
    )

    # We store phone_hash (not reversible) and phone_last4, city, province, zip.
    # We acknowledge the request. The merchant handles the export via Shopify admin.
    return {"ok": True}


@router.post("/customers-redact")
async def customers_redact(request: Request) -> dict[str, bool]:
    """Handle customers/redact — delete/anonymize customer data.

    Shopify sends this when a customer requests erasure under GDPR.
    We anonymize PII in orders and delete abandoned_forms for the customer.
    """
    body_bytes = await _verify_webhook_hmac(request)

    import orjson

    data: dict[str, Any] = orjson.loads(body_bytes)
    shop = str(data.get("shop_domain", ""))
    customer = data.get("customer", {})
    customer_phone: str = str(customer.get("phone", "")) if isinstance(customer, dict) else ""

    if not shop:
        log.warning("webhook_customer_redact_no_shop")
        return {"ok": False}

    shop_id = await pool.fetchval(
        "SELECT id FROM shops WHERE shop_domain = $1", shop
    )
    if not shop_id:
        log.warning("webhook_customer_redact_unknown_shop", shop=shop)
        return {"ok": True}  # 200 OK — shop not in our system

    redacted = 0

    # If we have phone, hash it and anonymize matching orders
    if customer_phone:
        phone_clean = customer_phone.replace(" ", "").replace("-", "")
        phone_hash = hashlib.sha256(phone_clean.encode()).hexdigest()

        # Anonymize order records
        result = await pool.execute(
            """UPDATE orders
               SET phone_hash = 'REDACTED', phone_last4 = 'XXXX',
                   city = 'REDACTED', province = '', zip = '', ip = ''
               WHERE shop_id = $1 AND phone_hash = $2""",
            shop_id,
            phone_hash,
        )
        redacted += int(result.split()[-1]) if result else 0

        # Delete abandoned form captures
        await pool.execute(
            "DELETE FROM abandoned_forms WHERE shop_id = $1 AND phone = $2",
            shop_id,
            phone_clean,
        )

    # Also try with orders_requested if provided
    orders_requested = data.get("orders_requested", [])
    if isinstance(orders_requested, list):
        for order_id in orders_requested:
            if isinstance(order_id, int):
                await pool.execute(
                    """UPDATE orders
                       SET phone_hash = 'REDACTED', phone_last4 = 'XXXX',
                           city = 'REDACTED', province = '', zip = '', ip = ''
                       WHERE shop_id = $1 AND shopify_order_id = $2""",
                    shop_id,
                    order_id,
                )

    log.info("webhook_customer_redacted", shop=shop, redacted=redacted)
    return {"ok": True}


@router.post("/shop-redact")
async def shop_redact(request: Request) -> dict[str, bool]:
    """Handle shop/redact — delete ALL data for a shop.

    Shopify sends this 48h after app/uninstalled. We must delete everything.
    CASCADE on shops table handles related tables.
    """
    body_bytes = await _verify_webhook_hmac(request)

    import orjson

    data: dict[str, Any] = orjson.loads(body_bytes)
    shop = str(data.get("shop_domain", ""))

    if not shop:
        log.warning("webhook_shop_redact_no_shop")
        return {"ok": False}

    invalidate_token(shop)

    # Delete shop + all related data (CASCADE)
    result = await pool.execute(
        "DELETE FROM shops WHERE shop_domain = $1", shop
    )

    log.info("webhook_shop_redacted", shop=shop, deleted=result)
    return {"ok": True}
