"""Update PrietenBebe config to match BebeMate's form experience (Romanian)."""

import asyncio
import json
import os

import asyncpg


async def main() -> None:
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])

    # PrietenBebe shop_id = 1
    shop_id = 1

    updates = {
        "shipping": {
            "default_rate": "19.99",
            "free_threshold": 150,
            "province_rates": {},
            "rates": [],
        },
        "settings": {
            "post_order_redirect": "thank_you",
            "custom_redirect_url": "",
            "hide_checkout_button": True,
            "hide_buy_now_button": True,
            "show_on_cart_page": False,
            "custom_css": "",
            "enable_discount_codes": True,
            "disable_for_oos": True,
            "sticky_buy_button": True,
            "abandoned_recovery_enabled": False,
            "abandoned_recovery_delay_minutes": 30,
            "abandoned_recovery_max_per_day": 50,
            "cod_fee": 0,
            "cod_fee_label": "Taxă ramburs",
            "google_places_api_key": "",
            "address_autocomplete_enabled": False,
            "restrict_mode": "all",
            "allowed_product_ids": [],
            "excluded_product_ids": [],
        },
        "bumps": {
            "enabled": True,
            "items": [
                {
                    "variant_id": 53700766564681,
                    "title": "Set Diversificare",
                    "price": "84.99",
                    "text": "Adaugă <b>Set Diversificare</b> la doar <b>84,99 lei</b>",
                    "enabled": True,
                    "quantity": 1,
                    "target_product_ids": [],
                    "style": {
                        "checkbox_color": "#b5a1e0",
                        "bg_color": "#f5f0ff",
                        "border_color": "#d4c5f0",
                        "border_style": "dashed",
                        "ticked_by_default": False,
                        "show_image": True,
                    },
                },
                {
                    "variant_id": 51539040469321,
                    "title": "Protecții Colțuri",
                    "price": "30.00",
                    "text": "Adaugă <b>Protecții Colțuri</b> la doar <b>30 lei</b>",
                    "enabled": True,
                    "quantity": 1,
                    "target_product_ids": [],
                    "style": {
                        "checkbox_color": "#b5a1e0",
                        "bg_color": "#f5f0ff",
                        "border_color": "#d4c5f0",
                        "border_style": "dashed",
                        "ticked_by_default": False,
                        "show_image": True,
                    },
                },
                {
                    "variant_id": 52673071055177,
                    "title": "Siguranțe Uși",
                    "price": "40.00",
                    "text": "Adaugă <b>Siguranțe Uși</b> la doar <b>40 lei</b>",
                    "enabled": True,
                    "quantity": 1,
                    "target_product_ids": [],
                    "style": {
                        "checkbox_color": "#b5a1e0",
                        "bg_color": "#f5f0ff",
                        "border_color": "#d4c5f0",
                        "border_style": "dashed",
                        "ticked_by_default": False,
                        "show_image": True,
                    },
                },
                {
                    "variant_id": 51759157346633,
                    "title": "Cască Protecție Cap",
                    "price": "80.00",
                    "text": "Adaugă <b>Cască Protecție Cap</b> la doar <b>80 lei</b>",
                    "enabled": True,
                    "quantity": 1,
                    "target_product_ids": [],
                    "style": {
                        "checkbox_color": "#b5a1e0",
                        "bg_color": "#f5f0ff",
                        "border_color": "#d4c5f0",
                        "border_style": "dashed",
                        "ticked_by_default": False,
                        "show_image": True,
                    },
                },
                {
                    "variant_id": 53602629353801,
                    "title": "Pieptăn Cruste",
                    "price": "30.00",
                    "text": "Adaugă <b>Pieptăn Cruste</b> la doar <b>30 lei</b>",
                    "enabled": True,
                    "quantity": 1,
                    "target_product_ids": [],
                    "style": {
                        "checkbox_color": "#b5a1e0",
                        "bg_color": "#f5f0ff",
                        "border_color": "#d4c5f0",
                        "border_style": "dashed",
                        "ticked_by_default": False,
                        "show_image": True,
                    },
                },
            ],
        },
        "upsells": {
            "enabled": True,
            "default_product_ids": [10017622786377],  # Aspirator Nazal
            "product_mappings": {},
            "default_timer_duration": 60,
            "default_accept_text": "Da, adaugă la comandă!",
            "default_reject_text": "Nu, mulțumesc, finalizați comanda",
            "offers": [],
        },
    }

    for section, data in updates.items():
        json_str = json.dumps(data)
        await conn.execute(
            """
            INSERT INTO shop_configs (shop_id, section, config)
            VALUES ($1, $2, $3::jsonb)
            ON CONFLICT (shop_id, section) DO UPDATE SET config = $3::jsonb, updated_at = NOW()
            """,
            shop_id,
            section,
            json_str,
        )
        print(f"  {section}: updated")

    # Clear config cache by restarting (or we wait for TTL)
    print("\nConfig updated. Cache TTL is 60s — changes take effect within a minute.")
    await conn.close()


asyncio.run(main())
