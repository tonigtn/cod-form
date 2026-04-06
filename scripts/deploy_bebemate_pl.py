"""Deploy COD form config to BebeMate PL (jcqx7t-0b.myshopify.com).

Mirrors PrietenBebe config with Polish translations and PLN prices.
Run after OAuth install completes and shop is in the DB.

Usage: uv run python scripts/deploy_bebemate_pl.py
"""

from __future__ import annotations

import asyncio
import json
import sys

sys.path.insert(0, ".")

from app.db.pool import close_pool, execute, fetchval, init_pool  # noqa: E402

SHOP = "jcqx7t-0b.myshopify.com"

# ── Product variant IDs (from Shopify API) ──────────────────────────────

# Bumps (order add-ons)
BUMP_FEEDING_SET = 61451737465162  # Silikonowy zestaw do karmienia 8 el. — 82.99 PLN
BUMP_CORNER_PROTECTORS = 61451737104714  # Ochraniacze narożników 10 szt. — 29.99 PLN
BUMP_DOOR_LOCKS = 61451737792842  # Blokady Bezpieczeństwa 3 szt. — 39.99 PLN
BUMP_HEAD_HELMET = 61451726094666  # Kask ochronny (Smok) — 78.99 PLN
BUMP_CRADLE_CAP_COMB = 61451735433546  # Grzebyk do ciemieniuchy — 29.99 PLN

# Upsells
UPSELL_PILLOW_PRODUCT_ID = 15570904482122  # Poduszka antyodkształceniowa
UPSELL_ASPIRATOR_PRODUCT_ID = 15570895470922  # Aspirator do nosa

# Offers (quantity discounts)
OFFER_BOTTLE_PRODUCT_ID = 15570895995210  # Butelka Hands-Free


async def deploy() -> None:
    """Push all config sections for bebemate.pl."""
    await init_pool()

    # Get shop_id from DB
    shop_id = await fetchval(
        "SELECT id FROM shops WHERE shop_domain = $1", SHOP
    )
    if not shop_id:
        print(f"ERROR: Shop {SHOP} not found in DB. Run OAuth install first.")
        print(f"Visit: https://api.magazinultarii.ro/auth/install?shop={SHOP}")
        await close_pool()
        return

    # Update shop metadata
    await execute(
        "UPDATE shops SET locale = 'pl', country_code = 'PL', currency = 'PLN', store_name = 'BebeMate PL' WHERE id = $1",
        shop_id,
    )
    print(f"Shop {SHOP} (id={shop_id}) — metadata updated to PL/PLN")

    # ── Button Style (same as PrietenBebe) ──
    await _save(shop_id, "button_style", {
        "text": "Zamawiam za pobraniem",
        "subtitle": "Płatność przy odbiorze",
        "text_color": "#ffffff",
        "text_size": "16px",
        "bg_color": "#b5a1e0",
        "hover_bg_color": "#6a6095",
        "border_color": "",
        "border_radius": "8px",
        "icon": "arrow",
    })

    # ── Form Style ──
    await _save(shop_id, "form_style", {
        "bg_color": "#ffffff",
        "text_color": "#333333",
        "header_text_color": "#111111",
        "label_color": "#555555",
        "border_radius": "12px",
        "max_width": "480px",
        "overlay_opacity": "0.5",
        "product_image_size": "80px",
        "accent_color": "#b5a1e0",
    })

    # ── Form Settings ──
    await _save(shop_id, "form", {
        "enabled": True,
        "button_text": "Zamawiam za pobraniem",
        "custom_note_prefix": "Zamówienie COD — płatność przy odbiorze",
        "tags": ["cod-form", "za-pobraniem"],
    })

    # ── Settings ──
    await _save(shop_id, "settings", {
        "hide_checkout_button": True,
        "hide_buy_now_button": True,
        "enable_discount_codes": True,
        "disable_for_oos": True,
        "sticky_buy_button": True,
        "address_autocomplete_enabled": False,
        "google_places_api_key": "",
        "restrict_mode": "all",
        "allowed_product_ids": [],
        "excluded_product_ids": [],
        "cod_fee": 0,
        "cod_fee_label": "Opłata za pobranie",
        "custom_css": "",
    })

    # ── Shipping ──
    await _save(shop_id, "shipping", {
        "default_rate": "14.99",
        "free_threshold": 200,
        "province_rates": {},
        "rates": [],
    })

    # ── Bumps (same 5 products as PrietenBebe) ──
    await _save(shop_id, "bumps", {
        "enabled": True,
        "items": [
            {
                "variant_id": BUMP_FEEDING_SET,
                "title": "Silikonowy zestaw do karmienia 8 el.",
                "price": "82.99",
                "text": "Dodaj Silikonowy Zestaw do Karmienia — 8 elementów, bez BPA",
                "image_url": "",
                "quantity": 1,
                "enabled": True,
                "checkbox_color": "#b5a1e0",
                "bg_color": "#f5f0ff",
                "border_color": "#d4c5f0",
                "border_style": "dashed",
                "default_checked": False,
                "show_image": True,
            },
            {
                "variant_id": BUMP_CORNER_PROTECTORS,
                "title": "Ochraniacze narożników 10 szt.",
                "price": "29.99",
                "text": "Dodaj Ochraniacze Narożników — zestaw 10 sztuk",
                "image_url": "",
                "quantity": 1,
                "enabled": True,
                "checkbox_color": "#b5a1e0",
                "bg_color": "#f5f0ff",
                "border_color": "#d4c5f0",
                "border_style": "dashed",
                "default_checked": False,
                "show_image": True,
            },
            {
                "variant_id": BUMP_DOOR_LOCKS,
                "title": "Blokady Bezpieczeństwa 3 szt.",
                "price": "39.99",
                "text": "Dodaj Blokady Bezpieczeństwa Drzwi i Szafek — zestaw 3 sztuk",
                "image_url": "",
                "quantity": 1,
                "enabled": True,
                "checkbox_color": "#b5a1e0",
                "bg_color": "#f5f0ff",
                "border_color": "#d4c5f0",
                "border_style": "dashed",
                "default_checked": False,
                "show_image": True,
            },
            {
                "variant_id": BUMP_HEAD_HELMET,
                "title": "Kask ochronny dla niemowląt",
                "price": "78.99",
                "text": "Dodaj Kask Ochronny — zapobiega uderzeniom",
                "image_url": "",
                "quantity": 1,
                "enabled": True,
                "checkbox_color": "#b5a1e0",
                "bg_color": "#f5f0ff",
                "border_color": "#d4c5f0",
                "border_style": "dashed",
                "default_checked": False,
                "show_image": True,
            },
            {
                "variant_id": BUMP_CRADLE_CAP_COMB,
                "title": "Grzebyk do ciemieniuchy",
                "price": "29.99",
                "text": "Dodaj Grzebyk do Usuwania Ciemieniuchy",
                "image_url": "",
                "quantity": 1,
                "enabled": True,
                "checkbox_color": "#b5a1e0",
                "bg_color": "#f5f0ff",
                "border_color": "#d4c5f0",
                "border_style": "dashed",
                "default_checked": False,
                "show_image": True,
            },
        ],
    })

    # ── Upsells (pillow on all, aspirator on pillow only) ──
    await _save(shop_id, "upsells", {
        "enabled": True,
        "default_product_ids": [UPSELL_PILLOW_PRODUCT_ID],
        "product_mappings": {
            str(UPSELL_PILLOW_PRODUCT_ID): [UPSELL_ASPIRATOR_PRODUCT_ID],
        },
        "default_timer_duration": 60,
        "default_accept_text": "Tak, dodaj do zamówienia!",
        "default_reject_text": "Nie, dziękuję, zakończ zamówienie",
        "offers": [],
    })

    # ── Offer Groups (Biberon/Butelka 2x = 25% off) ──
    await _save(shop_id, "offer_groups", [
        {
            "name": "Butelka Hands-Free 2x",
            "product_ids": [OFFER_BOTTLE_PRODUCT_ID],
            "enabled": True,
            "tiers": [
                {
                    "min_qty": 2,
                    "discount_type": "percentage",
                    "discount_percent": 25,
                    "discount_fixed": 0,
                    "title": "2 Butelki",
                    "tag": "Popularne",
                    "tag_bg": "#b5a1e0",
                    "label": "-25%",
                    "image_url": "",
                    "preselect": False,
                },
            ],
        },
    ])

    # ── Offers Style ──
    await _save(shop_id, "offers_style", {
        "template": "modern",
        "border_radius": "12px",
        "active_bg": "#f5f0ff",
        "active_border": "#b5a1e0",
        "inactive_bg": "#ffffff",
        "inactive_border": "#e0e0e0",
        "tag_bg": "#b5a1e0",
        "tag_text_color": "#ffffff",
        "tag_text_size": "12px",
        "tag_bold": True,
        "tag_italic": False,
        "label_bg": "#2E7D32",
        "label_text_color": "#ffffff",
        "label_text_size": "11px",
        "label_bold": True,
        "label_italic": False,
        "title_color": "#333",
        "title_size": "14px",
        "title_bold": True,
        "title_italic": False,
        "price_color": "#C62828",
        "price_size": "14px",
        "price_bold": True,
        "price_italic": False,
    })

    # ── Fraud ──
    await _save(shop_id, "fraud", {
        "duplicate_window_hours": 0,
        "duplicate_window_minutes": 1,
        "blocked_postal_codes": [],
        "blocked_phones": [],
        "blocked_ips": [],
        "otp_enabled": False,
    })

    # ── Pixels (empty — configure later) ──
    await _save(shop_id, "pixels", {
        "gads_conversion_id": "",
        "gads_conversion_label": "",
        "tiktok_pixel_id": "",
        "tiktok_access_token": "",
        "pinterest_tag_id": "",
        "snapchat_pixel_id": "",
        "fb_pixel_id": "",
        "fb_access_token": "",
        "fb_test_event_code": "",
        "event_matrix": {},
    })

    # ── Downsell (disabled) ──
    await _save(shop_id, "downsell", {
        "enabled": False,
    })

    # ── Prepaid (card payment button) ──
    await _save(shop_id, "prepaid", {
        "enabled": True,
        "button_text": "\U0001f4b3 Zapłać kartą",
        "discount_type": "percentage",
        "discount_value": 0,
        "discount_code": "",
    })

    # ── Auto Discounts (none for now) ──
    await _save(shop_id, "auto_discounts", {
        "enabled": False,
        "discounts": [],
    })

    await close_pool()
    print("\nAll config sections deployed for BebeMate PL!")
    print("Next steps:")
    print("  1. Add extension block to product templates via Shopify admin")
    print("  2. Or run: shopify app deploy --force")


async def _save(shop_id: int, section: str, data: dict | list) -> None:
    """Upsert a config section."""
    await execute(
        """
        INSERT INTO shop_configs (shop_id, section, config, updated_at)
        VALUES ($1, $2, $3::jsonb, NOW())
        ON CONFLICT (shop_id, section) DO UPDATE SET config = $3::jsonb, updated_at = NOW()
        """,
        shop_id,
        section,
        json.dumps(data),
    )
    print(f"  ✓ {section}")


if __name__ == "__main__":
    asyncio.run(deploy())
