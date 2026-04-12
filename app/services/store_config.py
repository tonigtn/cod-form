"""Per-shop COD configuration — DB-backed with in-memory TTL cache."""

from __future__ import annotations

import contextlib
import time
from typing import Any

import orjson
import structlog
from pydantic import BaseModel, Field

from app.db import pool
from app.schemas import OfferGroup

log = structlog.get_logger(__name__)

_CACHE_TTL = 60.0  # seconds


# ── Config models (frozen Pydantic) ────────────────────────────────────────


class CodFraudConfig(BaseModel, frozen=True):
    duplicate_window_hours: int = 4
    duplicate_window_minutes: int = 0
    blocked_postal_codes: list[str] = Field(default_factory=list)
    blocked_phones: list[str] = Field(default_factory=list)
    blocked_ips: list[str] = Field(default_factory=list)
    otp_enabled: bool = False


class CodShippingRate(BaseModel, frozen=True):
    name: str = "Livrare cu Ramburs"
    price: str = "19.99"
    min_order: float = 0
    max_order: float | None = None
    min_qty: int = 0
    max_qty: int | None = None
    product_ids: list[int] = Field(default_factory=list)
    exclude_product_ids: list[int] = Field(default_factory=list)


class CodShippingConfig(BaseModel, frozen=True):
    default_rate: str = "19.99"
    free_threshold: float = 0
    province_rates: dict[str, str] = Field(default_factory=dict)
    rates: list[CodShippingRate] = Field(default_factory=list)


class CodPixelConfig(BaseModel, frozen=True):
    gads_conversion_id: str = ""
    gads_conversion_label: str = ""
    tiktok_pixel_id: str = ""
    tiktok_access_token: str = ""
    pinterest_tag_id: str = ""
    snapchat_pixel_id: str = ""
    fb_pixel_id: str = ""
    fb_access_token: str = ""
    fb_test_event_code: str = ""
    ga4_measurement_id: str = ""
    event_matrix: dict[str, list[str]] = Field(default_factory=dict)


class CodFormField(BaseModel, frozen=True):
    id: str
    label: str = ""
    placeholder: str = ""
    field_type: str = "text"
    visible: bool = True
    required: bool = False
    order: int = 0
    half_width: bool = False
    options: list[str] = Field(default_factory=list)


class CodFormLayout(BaseModel, frozen=True):
    fields: list[CodFormField] = Field(default_factory=list)


class CodFormConfig(BaseModel, frozen=True):
    enabled: bool = True
    button_text: str = "Comandă cu plata la livrare"
    custom_note_prefix: str = "Comandă COD — plata ramburs la livrare"
    tags: list[str] = Field(default_factory=lambda: ["cod-form", "plata-la-livrare"])
    layout: CodFormLayout = Field(default_factory=CodFormLayout)


class CodUpsellOffer(BaseModel, frozen=True):
    product_id: int
    discount_amount: float = 0
    header_text: str = ""
    subheader_text: str = ""
    discount_badge_text: str = ""
    timer_duration: int = 0
    accept_text: str = ""
    accept_color: str = ""
    reject_text: str = ""


class CodUpsellConfig(BaseModel, frozen=True):
    enabled: bool = False
    default_product_ids: list[int] = Field(default_factory=list)
    product_mappings: dict[str, list[int]] = Field(default_factory=dict)
    downsell_product_id: int | None = None
    default_timer_duration: int = 60
    default_accept_text: str = "Da, adaugă la comandă!"
    default_reject_text: str = "Nu, mulțumesc"
    offers: list[CodUpsellOffer] = Field(default_factory=list)


class CodButtonStyle(BaseModel, frozen=True):
    text: str = "Comandă cu plata la livrare"
    subtitle: str = ""
    text_color: str = "#ffffff"
    text_size: str = "16px"
    bg_color: str = "#C62828"
    bg_color_hover: str = "#B71C1C"
    border_color: str = ""
    border_width: str = "0px"
    border_radius: str = "8px"
    animation: str = "none"
    icon: str = "cash"


class CodFormStyle(BaseModel, frozen=True):
    bg_color: str = "#ffffff"
    text_color: str = "#333333"
    header_text_color: str = "#111111"
    label_color: str = "#555555"
    border_radius: str = "12px"
    max_width: str = "480px"
    overlay_opacity: str = "0.5"
    product_image_size: str = "80px"
    accent_color: str = "#C62828"


class CodBumpStyle(BaseModel, frozen=True):
    checkbox_color: str = "#C62828"
    bg_color: str = "#fff8e1"
    border_color: str = "#ffe082"
    border_style: str = "dashed"
    ticked_by_default: bool = False
    show_image: bool = True


class CodBumpItem(BaseModel, frozen=True):
    variant_id: int
    title: str = ""
    price: str = "0.00"
    image_url: str = ""
    text: str = ""
    target_product_ids: list[int] = Field(default_factory=list)
    quantity: int = 1
    enabled: bool = True
    style: CodBumpStyle = Field(default_factory=CodBumpStyle)


class CodBumpsConfig(BaseModel, frozen=True):
    enabled: bool = False
    items: list[CodBumpItem] = Field(default_factory=list)


class CodDownsellConfig(BaseModel, frozen=True):
    enabled: bool = False
    message: str = "Stai! Ai un cod special de reducere!"
    discount_code: str = ""
    button_text: str = "Aplică reducerea"
    target_product_ids: list[int] = Field(default_factory=list)
    message_color: str = "#333333"
    badge_bg_color: str = "#C62828"
    badge_text_color: str = "#ffffff"
    button_bg_color: str = "#C62828"
    button_text_color: str = "#ffffff"
    bg_color: str = "#ffffff"
    show_after_closes: int = 1


class CodSettingsConfig(BaseModel, frozen=True):
    post_order_redirect: str = "thank_you"
    custom_redirect_url: str = ""
    hide_checkout_button: bool = True
    hide_buy_now_button: bool = True
    show_on_cart_page: bool = False
    custom_css: str = ""
    enable_discount_codes: bool = True
    disable_for_oos: bool = True
    sticky_buy_button: bool = True
    abandoned_recovery_enabled: bool = False
    abandoned_recovery_delay_minutes: int = 30
    abandoned_recovery_max_per_day: int = 50
    cod_fee: float = 0
    cod_fee_label: str = "Taxă ramburs"
    google_places_api_key: str = ""
    address_autocomplete_enabled: bool = False
    restrict_mode: str = "all"
    allowed_product_ids: list[int] = Field(default_factory=list)
    excluded_product_ids: list[int] = Field(default_factory=list)
    announcement_text: str = ""


class CodOffersStyle(BaseModel, frozen=True):
    template: str = "classic"
    show_in: str = "page"
    border_radius: str = "8px"
    active_bg: str = "#FFF8F8"
    active_border: str = "#C62828"
    inactive_bg: str = "#ffffff"
    inactive_border: str = "#e0e0e0"
    tag_bg: str = "#C62828"
    tag_text_color: str = "#ffffff"
    tag_text_size: str = "12px"
    tag_bold: bool = True
    tag_italic: bool = False
    label_bg: str = "#2E7D32"
    label_text_color: str = "#ffffff"
    label_text_size: str = "11px"
    label_bold: bool = True
    label_italic: bool = False
    title_color: str = "#333333"
    title_size: str = "14px"
    title_bold: bool = True
    title_italic: bool = False
    price_color: str = "#C62828"
    price_size: str = "14px"
    price_bold: bool = True
    price_italic: bool = False
    inactive_tag_bg: str = "#292524"
    hide_product_image: bool = False
    hide_comparison_price: bool = False
    hide_offers_higher_qty: bool = False
    add_title_to_order: bool = False
    use_comparison_price: bool = False
    disable_variant_selection: bool = False


class CodPrepaidConfig(BaseModel, frozen=True):
    enabled: bool = False
    button_text: str = "Plătește online"
    discount_type: str = "percentage"
    discount_value: float = 0
    discount_code: str = ""
    discount_label: str = ""


class CodAutoDiscount(BaseModel, frozen=True):
    product_id: int
    discount_amount: float
    label: str = ""


class CodAutoDiscountsConfig(BaseModel, frozen=True):
    enabled: bool = False
    discounts: list[CodAutoDiscount] = Field(default_factory=list)


class CodStoreConfig(BaseModel, frozen=True):
    """Root config for a single shop's COD form."""

    offer_groups: list[OfferGroup] = Field(default_factory=list)
    fraud: CodFraudConfig = Field(default_factory=CodFraudConfig)
    shipping: CodShippingConfig = Field(default_factory=CodShippingConfig)
    pixels: CodPixelConfig = Field(default_factory=CodPixelConfig)
    form: CodFormConfig = Field(default_factory=CodFormConfig)
    upsells: CodUpsellConfig = Field(default_factory=CodUpsellConfig)
    bumps: CodBumpsConfig = Field(default_factory=CodBumpsConfig)
    downsell: CodDownsellConfig = Field(default_factory=CodDownsellConfig)
    settings: CodSettingsConfig = Field(default_factory=CodSettingsConfig)
    button_style: CodButtonStyle = Field(default_factory=CodButtonStyle)
    form_style: CodFormStyle = Field(default_factory=CodFormStyle)
    prepaid: CodPrepaidConfig = Field(default_factory=CodPrepaidConfig)
    offers_style: CodOffersStyle = Field(default_factory=CodOffersStyle)
    auto_discounts: CodAutoDiscountsConfig = Field(default_factory=CodAutoDiscountsConfig)


# ── Section name → model mapping ──────────────────────────────────────────

_SECTION_MODELS: dict[str, type[BaseModel]] = {
    "fraud": CodFraudConfig,
    "shipping": CodShippingConfig,
    "pixels": CodPixelConfig,
    "form": CodFormConfig,
    "upsells": CodUpsellConfig,
    "bumps": CodBumpsConfig,
    "downsell": CodDownsellConfig,
    "settings": CodSettingsConfig,
    "button_style": CodButtonStyle,
    "form_style": CodFormStyle,
    "prepaid": CodPrepaidConfig,
    "offers_style": CodOffersStyle,
    "auto_discounts": CodAutoDiscountsConfig,
}

VALID_SECTIONS = frozenset(_SECTION_MODELS.keys()) | {"offer_groups"}


# ── TTL cache ─────────────────────────────────────────────────────────────

_cache: dict[int, tuple[CodStoreConfig, float]] = {}


async def load_store_config(shop_id: int) -> CodStoreConfig:
    """Load full store config from DB with 60s TTL cache."""
    now = time.monotonic()
    cached = _cache.get(shop_id)
    if cached and (now - cached[1]) < _CACHE_TTL:
        return cached[0]

    rows = await pool.fetch("SELECT section, config FROM shop_configs WHERE shop_id = $1", shop_id)

    merged: dict[str, Any] = {}
    for row in rows:
        val = row["config"]
        # Unwrap double/triple-encoded JSON strings
        import json
        for _ in range(3):
            if not isinstance(val, str):
                break
            with contextlib.suppress(json.JSONDecodeError, TypeError):
                val = json.loads(val)
        merged[row["section"]] = val

    try:
        config = CodStoreConfig.model_validate(merged)
    except Exception:
        config = CodStoreConfig()

    _cache[shop_id] = (config, now)
    return config


async def update_config_section(shop_id: int, section: str, data: dict[str, Any]) -> None:
    """Update a single config section in DB."""
    json_bytes = orjson.dumps(data)
    await pool.execute(
        """
        INSERT INTO shop_configs (shop_id, section, config, updated_at)
        VALUES ($1, $2, $3::jsonb, NOW())
        ON CONFLICT (shop_id, section) DO UPDATE
        SET config = $3::jsonb, updated_at = NOW()
        """,
        shop_id,
        section,
        json_bytes.decode(),
    )
    # Invalidate cache
    _cache.pop(shop_id, None)


async def load_config_dict(shop_id: int) -> dict[str, Any]:
    """Load config as raw dict (for admin API responses)."""
    rows = await pool.fetch("SELECT section, config FROM shop_configs WHERE shop_id = $1", shop_id)
    result: dict[str, Any] = {}
    for row in rows:
        val = row["config"]
        # asyncpg may return JSONB as string — parse it
        if isinstance(val, str):
            import json

            with contextlib.suppress(json.JSONDecodeError, TypeError):
                val = json.loads(val)
        result[row["section"]] = val
    return result


def clear_config_cache() -> None:
    """Clear the config cache (for testing)."""
    _cache.clear()
