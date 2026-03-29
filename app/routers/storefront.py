"""Public storefront-facing API endpoints."""

from __future__ import annotations

import asyncio
import re
import time
from collections import defaultdict
from typing import Any

import structlog
from fastapi import APIRouter, Query, Request

from app.schemas import (
    CodOrderRequest,
    CodOrderResponse,
    DiscountValidationRequest,
    DiscountValidationResponse,
    OrderBumpsResponse,
    OtpSendRequest,
    OtpSendResponse,
    OtpVerifyRequest,
    OtpVerifyResponse,
    QuantityOffersResponse,
    UpsellAddRequest,
    UpsellAddResponse,
    UpsellsResponse,
)
from app.services.store_config import load_store_config
from app.shopify.tokens import get_shop_id

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/cod", tags=["storefront"])

# Rate limiting
_RATE_LIMIT = 5
_RATE_WINDOW = 60
_request_log: dict[str, list[float]] = defaultdict(list)

# Background tasks (prevent GC of fire-and-forget coroutines)
_background_tasks: set[asyncio.Task[object]] = set()


def _is_rate_limited(ip: str) -> bool:
    now = time.monotonic()
    timestamps = _request_log[ip]
    _request_log[ip] = [t for t in timestamps if now - t < _RATE_WINDOW]
    if len(_request_log[ip]) >= _RATE_LIMIT:
        return True
    _request_log[ip].append(now)
    return False


# Backwards compatibility: legacy store_id → shop domain mapping
# Existing themes send store_id=store_1, etc. Map to myshopify domains.
_LEGACY_STORE_MAP: dict[str, str] = {
    "store_1": "rmeai1-da.myshopify.com",
    "store_2": "10qaxg-sc.myshopify.com",
    "store_3": "wst6jx-73.myshopify.com",
    "store_4": "jgj1ff-ak.myshopify.com",
}


def _resolve_shop_param(shop: str = "", store_id: str = "") -> str:
    """Resolve shop domain from either shop or legacy store_id parameter."""
    if shop:
        return shop
    if store_id:
        return _LEGACY_STORE_MAP.get(store_id, store_id)
    return ""


async def _resolve_shop_id(shop: str) -> int | None:
    """Resolve shop domain to internal shop_id."""
    if not shop:
        return None
    return await get_shop_id(shop)


async def _validate_phone(phone: str, shop: str) -> str | None:
    """Validate phone format using locale-driven pattern."""
    from app.services.locale import get_shop_locale

    cleaned = phone.replace(" ", "").replace("-", "")
    if not cleaned.isdigit():
        locale = await get_shop_locale(shop)
        return str(locale.get("phone_error", "Invalid phone number"))

    locale = await get_shop_locale(shop)
    pattern = str(locale.get("phone_pattern", r"^0\d{9}$"))
    if not re.match(pattern, cleaned):
        return str(locale.get("phone_error", "Invalid phone number"))
    return None


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/form-config")
async def form_config_endpoint(
    shop: str = Query(default="", description="Shop domain"),
    store_id: str = Query(default="", description="Legacy store identifier"),
) -> dict[str, Any]:
    """Return merged form config for storefront rendering."""
    shop = _resolve_shop_param(shop, store_id)
    shop_id = await _resolve_shop_id(shop)
    if not shop_id:
        return {}

    from app.services.locale import get_shop_locale

    config = await load_store_config(shop_id)
    locale = await get_shop_locale(shop)
    layout_fields = [f.model_dump() for f in config.form.layout.fields]

    # Override announcement from per-store settings if set
    announcement = (
        config.settings.announcement_text
        if hasattr(config.settings, "announcement_text") and config.settings.announcement_text
        else None
    )
    if not announcement:
        labels = locale.get("labels", {})
        announcement = labels.get("announcement", "") if isinstance(labels, dict) else ""
    locale_copy = dict(locale)
    if isinstance(locale_copy.get("labels"), dict):
        locale_copy["labels"] = {**locale_copy["labels"], "announcement": announcement}

    return {
        "locale": locale_copy,
        "button_style": config.button_style.model_dump(),
        "form_style": config.form_style.model_dump(),
        "form": {
            "enabled": config.form.enabled,
            "button_text": config.form.button_text,
        },
        "layout": layout_fields,
        "settings": {
            "hide_checkout_button": config.settings.hide_checkout_button,
            "hide_buy_now_button": config.settings.hide_buy_now_button,
            "custom_css": config.settings.custom_css,
            "enable_discount_codes": config.settings.enable_discount_codes,
            "disable_for_oos": config.settings.disable_for_oos,
            "sticky_buy_button": config.settings.sticky_buy_button,
            "address_autocomplete_enabled": config.settings.address_autocomplete_enabled,
            "google_places_api_key": config.settings.google_places_api_key,
            "restrict_mode": config.settings.restrict_mode,
            "allowed_product_ids": config.settings.allowed_product_ids,
            "excluded_product_ids": config.settings.excluded_product_ids,
            "cod_fee": config.settings.cod_fee,
            "cod_fee_label": config.settings.cod_fee_label,
        },
        "upsell_config": {
            "default_timer_duration": config.upsells.default_timer_duration,
            "default_accept_text": config.upsells.default_accept_text,
            "default_reject_text": config.upsells.default_reject_text,
            "offers": [o.model_dump() for o in config.upsells.offers],
        },
        "shipping": {
            "default_rate": config.shipping.default_rate,
            "province_rates": config.shipping.province_rates,
        },
        "prepaid": config.prepaid.model_dump(),
        "offers_style": config.offers_style.model_dump(),
        "pixels": {
            "event_matrix": config.pixels.event_matrix,
            "fb_access_token": bool(config.pixels.fb_access_token),
        },
    }


@router.get("/offers")
async def offers_endpoint(
    shop: str = Query(default="", description="Shop domain"),
    store_id: str = Query(default="", description="Legacy store identifier"),
    product_id: int = Query(default=0, description="Product ID filter"),
) -> QuantityOffersResponse:
    """Return quantity offers for a shop."""
    shop = _resolve_shop_param(shop, store_id)
    shop_id = await _resolve_shop_id(shop)
    if not shop_id:
        return QuantityOffersResponse()

    from app.services.offers import get_offers

    pid = product_id if product_id > 0 else None
    return QuantityOffersResponse(offers=await get_offers(shop_id, product_id=pid))


@router.get("/shipping-rates")
async def shipping_rates_endpoint(
    shop: str = Query(default="", description="Shop domain"),
    store_id: str = Query(default="", description="Legacy store identifier"),
    order_total: float = Query(default=0),
    quantity: int = Query(default=1),
    product_id: int | None = Query(default=None),
) -> dict[str, Any]:
    """Return applicable shipping rates."""
    shop = _resolve_shop_param(shop, store_id)
    shop_id = await _resolve_shop_id(shop)
    if not shop_id:
        return {"rates": []}

    config = await load_store_config(shop_id)

    if config.shipping.rates:
        applicable = []
        for rate in config.shipping.rates:
            if order_total < rate.min_order:
                continue
            if rate.max_order is not None and order_total > rate.max_order:
                continue
            if rate.min_qty and quantity < rate.min_qty:
                continue
            if rate.max_qty is not None and quantity > rate.max_qty:
                continue
            if product_id and rate.product_ids and product_id not in rate.product_ids:
                continue
            if product_id and rate.exclude_product_ids and product_id in rate.exclude_product_ids:
                continue
            applicable.append({"name": rate.name, "price": rate.price})
        return {"rates": applicable}

    rates = []
    if config.shipping.free_threshold and order_total >= config.shipping.free_threshold:
        rates.append({"name": "Livrare gratuită", "price": "0"})
    else:
        rates.append({"name": "Livrare cu Ramburs", "price": config.shipping.default_rate})
    return {"rates": rates}


@router.get("/downsell")
async def downsell_endpoint(
    shop: str = Query(default="", description="Shop domain"),
    store_id: str = Query(default="", description="Legacy store identifier"),
    product_id: int | None = Query(default=None),
) -> dict[str, Any]:
    """Return downsell config."""
    shop = _resolve_shop_param(shop, store_id)
    shop_id = await _resolve_shop_id(shop)
    if not shop_id:
        return {"enabled": False}

    config = await load_store_config(shop_id)
    ds = config.downsell
    if ds.target_product_ids and product_id and product_id not in ds.target_product_ids:
        return {"enabled": False}

    return ds.model_dump()


@router.get("/bumps")
async def bumps_endpoint(
    shop: str = Query(default="", description="Shop domain"),
    store_id: str = Query(default="", description="Legacy store identifier"),
    product_id: int = Query(description="Current product ID"),
) -> OrderBumpsResponse:
    """Return order bumps for a product."""
    shop = _resolve_shop_param(shop, store_id)
    shop_id = await _resolve_shop_id(shop)
    if not shop_id:
        return OrderBumpsResponse()

    from app.services.bumps import get_bumps

    return await get_bumps(shop_id, product_id)


@router.post("/validate-discount")
async def validate_discount_endpoint(req: DiscountValidationRequest) -> DiscountValidationResponse:
    """Validate a Shopify discount code."""
    shop = req.shop or _LEGACY_STORE_MAP.get(req.store_id_legacy or "", "")
    if shop and shop != req.shop:
        req = req.model_copy(update={"shop": shop})
    from app.shopify.discounts import validate_discount

    return await validate_discount(req)


@router.post("/order")
async def create_order(req: CodOrderRequest, request: Request) -> CodOrderResponse:
    """Create a COD order via Shopify draft order flow."""
    client_ip = request.client.host if request.client else "unknown"

    if _is_rate_limited(client_ip):
        return CodOrderResponse(success=False, error="Prea multe cereri. Încearcă din nou.")

    # Backwards compat: resolve legacy store_id from body
    shop = req.shop or _LEGACY_STORE_MAP.get(req.store_id_legacy or "", "")
    if shop and shop != req.shop:
        req = req.model_copy(update={"shop": shop})
    shop_id = await _resolve_shop_id(req.shop)
    if not shop_id:
        return CodOrderResponse(success=False, error="Invalid store")

    # Validate phone
    phone_error = await _validate_phone(req.phone, req.shop)
    if phone_error:
        return CodOrderResponse(success=False, error=phone_error)

    # Fraud checks
    from app.services.fraud import check_fraud, log_order

    fraud_result = await check_fraud(req, client_ip, shop_id)
    if not fraud_result.passed:
        log.warning("cod_fraud_blocked", reason=fraud_result.reason, ip=client_ip)
        return CodOrderResponse(success=False, error=fraud_result.reason)

    # Inject tracking headers
    real_ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or client_ip
    mutable_fields = dict(req.custom_fields) if req.custom_fields else {}
    mutable_fields["_trk_ip"] = real_ip
    mutable_fields["_trk_ua"] = request.headers.get("user-agent", "")
    req = req.model_copy(update={"custom_fields": mutable_fields})

    log.info("cod_order_request", shop=req.shop, variant_id=req.variant_id, ip=client_ip)

    from app.shopify.orders import create_cod_order

    result = await create_cod_order(req, shop_id)

    if result.success:
        await log_order(req, client_ip, result.order_name, result.order_id, shop_id)

        # Mark abandoned as recovered
        from app.services.abandoned import mark_recovered

        draft_gid = await mark_recovered(shop_id, req.phone.replace(" ", "").replace("-", ""))
        if draft_gid:
            try:
                from app.shopify.abandoned import delete_abandoned_checkout

                task = asyncio.create_task(delete_abandoned_checkout(req.shop, draft_gid))
                _background_tasks.add(task)
                task.add_done_callback(_background_tasks.discard)
            except Exception:
                pass
    else:
        # Release pending lock so user can retry
        from app.services.fraud import release_pending_order

        await release_pending_order(req, shop_id)

    return result


@router.get("/otp-status")
async def otp_status_endpoint(
    shop: str = Query(default=""),
    store_id: str = Query(default="", description="Legacy store identifier"),
) -> dict[str, bool]:
    """Check if OTP is enabled for a shop."""
    shop = _resolve_shop_param(shop, store_id)
    shop_id = await _resolve_shop_id(shop)
    if not shop_id:
        return {"otp_enabled": False}
    config = await load_store_config(shop_id)
    return {"otp_enabled": config.fraud.otp_enabled}


@router.post("/otp/send")
async def otp_send_endpoint(req: OtpSendRequest, request: Request) -> OtpSendResponse:
    """Generate and send OTP code via WhatsApp."""
    shop = req.shop or _LEGACY_STORE_MAP.get(req.store_id_legacy or "", "")
    if shop and shop != req.shop:
        req = req.model_copy(update={"shop": shop})
    shop_id = await _resolve_shop_id(req.shop)
    if not shop_id:
        return OtpSendResponse(sent=False, error="Invalid store")

    client_ip = request.client.host if request.client else "unknown"
    if _is_rate_limited(client_ip):
        return OtpSendResponse(sent=False, error="Prea multe cereri.")

    phone_err = await _validate_phone(req.phone, req.shop)
    if phone_err:
        return OtpSendResponse(sent=False, error=phone_err)

    from app.services.otp import generate_otp, send_otp_whatsapp

    phone = req.phone.replace(" ", "").replace("-", "")
    code = generate_otp(req.shop, phone)

    # Get WhatsApp phone number ID from shop config (stored in pixels or a custom section)
    await load_store_config(shop_id)
    from app.services.locale import get_shop_locale

    locale = await get_shop_locale(req.shop)
    lang = str(locale.get("language", "ro"))

    # WhatsApp phone number ID would be stored in shop config
    # For now, fall back to env var pattern
    import os

    wa_phone_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
    sent = await send_otp_whatsapp(phone, code, wa_phone_id, locale=lang)

    if not sent:
        return OtpSendResponse(sent=False, error="Nu am putut trimite codul de verificare.")
    return OtpSendResponse(sent=True)


@router.post("/otp/verify")
async def otp_verify_endpoint(req: OtpVerifyRequest) -> OtpVerifyResponse:
    """Verify an OTP code."""
    from app.services.otp import verify_otp

    phone = req.phone.replace(" ", "").replace("-", "")
    verified, error = verify_otp(req.shop, phone, req.code.strip())
    return OtpVerifyResponse(verified=verified, error=error)


@router.post("/events")
async def track_event(request: Request) -> dict[str, bool]:
    """Log a form event."""
    try:
        body: dict[str, Any] = await request.json()
    except Exception:
        return {"ok": False}

    shop = str(body.get("shop", "")) or _LEGACY_STORE_MAP.get(str(body.get("store_id", "")), "")
    event_type = str(body.get("event", ""))
    if not event_type or not shop:
        return {"ok": False}

    shop_id = await _resolve_shop_id(shop)
    if not shop_id:
        return {"ok": False}

    from app.services.events import log_event

    client_ip = request.client.host if request.client else "unknown"
    ok = await log_event(
        event_type=event_type,
        shop_id=shop_id,
        ip=client_ip,
        product_id=int(body.get("product_id", 0)),
        variant_id=int(body.get("variant_id", 0)),
        order_value=float(body.get("order_value", 0)),
        utm_source=str(body.get("utm_source", "")),
        utm_medium=str(body.get("utm_medium", "")),
        utm_campaign=str(body.get("utm_campaign", "")),
    )
    return {"ok": ok}


@router.post("/form-partial")
async def form_partial_endpoint(request: Request) -> dict[str, bool]:
    """Capture partial form data for abandoned form recovery."""
    try:
        body: dict[str, Any] = await request.json()
    except Exception:
        return {"ok": False}

    shop = str(body.get("shop", "")) or _LEGACY_STORE_MAP.get(str(body.get("store_id", "")), "")
    phone = str(body.get("phone", "")).replace(" ", "").replace("-", "")
    if not shop or len(phone) < 10:
        return {"ok": False}

    shop_id = await _resolve_shop_id(shop)
    if not shop_id:
        return {"ok": False}

    from app.services.abandoned import log_abandoned

    ok = await log_abandoned(
        shop_id=shop_id,
        phone=phone,
        first_name=str(body.get("first_name", "")),
        product_id=int(body.get("product_id", 0)),
        variant_id=int(body.get("variant_id", 0)),
        unit_price=float(body.get("unit_price", 0)),
        province=str(body.get("province", "")),
    )
    return {"ok": ok}


@router.get("/abandoned-stats")
async def abandoned_stats_endpoint(
    shop: str = Query(default=""),
    store_id: str = Query(default="", description="Legacy store identifier"),
) -> dict[str, int]:
    """Get abandoned form stats."""
    shop = _resolve_shop_param(shop, store_id)
    shop_id = await _resolve_shop_id(shop)
    if not shop_id:
        return {"total": 0, "today": 0, "recovered": 0, "reminder_sent": 0}

    from app.services.abandoned import get_abandoned_stats

    return await get_abandoned_stats(shop_id)


@router.get("/upsells")
async def upsells_endpoint(
    shop: str = Query(default=""),
    store_id: str = Query(default="", description="Legacy store identifier"),
    product_id: int = Query(description="Purchased product ID"),
) -> UpsellsResponse:
    """Return upsell products."""
    shop = _resolve_shop_param(shop, store_id)
    shop_id = await _resolve_shop_id(shop)
    if not shop_id:
        return UpsellsResponse()

    from app.services.upsells import get_upsell_products

    return await get_upsell_products(shop, shop_id, product_id)


@router.post("/upsell/add")
async def upsell_add_endpoint(req: UpsellAddRequest) -> UpsellAddResponse:
    """Add an upsell variant to an existing order."""
    from app.services.upsells import add_upsell_to_order

    return await add_upsell_to_order(req)
