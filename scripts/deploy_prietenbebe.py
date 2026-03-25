"""Deploy COD form to PrietenBebe: theme files + config with bumps/upsells."""

import asyncio
import json
import os
from pathlib import Path

import asyncpg
import httpx
from cryptography.fernet import Fernet

SHOP = "rmeai1-da.myshopify.com"

# BebeMate's theme files are the most complete — use as base
BEBEMATE_THEME = Path.home() / "ai-agents" / "themes" / "bebemate"

# PrietenBebe products for bumps (similar to BebeMate's bump categories)
BUMPS = [
    {
        "variant_id": 53700766564681,  # Set Diversificare 8 Piese
        "title": "Set Diversificare",
        "price": "84.99",
        "text": "Adaugă <b>Set Diversificare</b> — 8 piese silicon BPA free",
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
        "variant_id": 51539040469321,  # Protecții Colțuri Set 10
        "title": "Protecții Colțuri",
        "price": "30.00",
        "text": "Adaugă <b>Protecții Colțuri</b> — set de 10 bucăți",
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
        "variant_id": 52673071055177,  # Siguranțe Uși Set 3
        "title": "Siguranțe Uși",
        "price": "40.00",
        "text": "Adaugă <b>Siguranțe Uși și Dulapuri</b> — set de 3 bucăți",
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
        "variant_id": 51759157346633,  # Cască Protecție Cap
        "title": "Cască Protecție",
        "price": "80.00",
        "text": "Adaugă <b>Cască Protecție Cap</b> — anti lovituri",
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
        "variant_id": 53602629353801,  # Pieptăn Cruste
        "title": "Pieptăn Cruste",
        "price": "30.00",
        "text": "Adaugă <b>Pieptăn Îndepărtare Cruste</b>",
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
]

# Get image URLs for each bump product
BUMP_PRODUCT_IDS = [
    53700766564681,  # Set Diversificare
    51539040469321,  # Protecții
    52673071055177,  # Siguranțe
    51759157346633,  # Cască
    53602629353801,  # Pieptăn
]


async def main() -> None:
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    row = await conn.fetchrow(
        "SELECT id, access_token_encrypted FROM shops WHERE shop_domain = $1", SHOP
    )
    f = Fernet(os.environ["FERNET_KEY"].encode())
    token = f.decrypt(row["access_token_encrypted"].encode()).decode()
    shop_id = row["id"]

    h = {"X-Shopify-Access-Token": token, "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=30) as c:
        # Get live theme
        r = await c.get(f"https://{SHOP}/admin/api/2025-01/themes.json", headers=h)
        themes = r.json().get("themes", [])
        live = next((t for t in themes if t["role"] == "main"), None)
        tid = live["id"]
        print(f"Theme: {live.get('name', '?')} ID: {tid}")

        # Get product images for bumps
        r = await c.get(
            f"https://{SHOP}/admin/api/2025-01/products.json?status=active&limit=50",
            headers=h,
        )
        products = r.json().get("products", [])
        variant_images: dict[int, str] = {}
        for p in products:
            img = p.get("image")
            img_url = img.get("src", "") if img else ""
            for v in p["variants"]:
                variant_images[v["id"]] = img_url

        # Set image URLs on bumps
        for bump in BUMPS:
            bump["image_url"] = variant_images.get(bump["variant_id"], "")
            print(f"  Bump: {bump['title']} — img={'Y' if bump['image_url'] else 'N'}")

        # ── Deploy theme files ──
        print("\n--- Deploying theme files ---")

        # Read BebeMate's files as base
        css_content = (BEBEMATE_THEME / "assets" / "cod-form.css").read_text()
        js_content = (BEBEMATE_THEME / "assets" / "cod-form.js").read_text()
        liquid_content = (BEBEMATE_THEME / "sections" / "cod-form.liquid").read_text()

        # Adapt liquid for PrietenBebe (change store_id default to store_1)
        liquid_content = liquid_content.replace(
            '"store_4"', '"store_1"'
        ).replace(
            'default: "store_4"', 'default: "store_1"'
        )

        # Add submit button !important fix to CSS
        css_fix = """
/* Fix: override theme button styles */
.cod-form__submit, #cod-submit-btn {
  background: var(--color-primary, #b5a1e0) !important;
  color: #fff !important;
  border: none !important;
  padding: 0.9rem !important;
  border-radius: 8px !important;
  font-size: 1rem !important;
  font-weight: 600 !important;
  width: 100% !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.5rem !important;
  margin-top: 1rem !important;
}
.cod-form__submit:hover, #cod-submit-btn:hover {
  background: var(--color-primary-dark, #6a6095) !important;
}
"""
        if "override theme button" not in css_content:
            css_content += css_fix

        # Push files
        for key, content in [
            ("sections/cod-form.liquid", liquid_content),
            ("assets/cod-form.js", js_content),
            ("assets/cod-form.css", css_content),
        ]:
            r = await c.put(
                f"https://{SHOP}/admin/api/2025-01/themes/{tid}/assets.json",
                headers=h,
                json={"asset": {"key": key, "value": content}},
            )
            print(f"  {key}: {r.status_code} ({'OK' if r.status_code == 200 else r.text[:100]})")

    # ── Update config in DB ──
    print("\n--- Updating config ---")

    configs = {
        "button_style": {
            "text": "Comandă cu plata la livrare",
            "subtitle": "Plata la livrare",
            "text_color": "#ffffff",
            "text_size": "16px",
            "bg_color": "#b5a1e0",
            "bg_color_hover": "#6a6095",
            "border_color": "",
            "border_width": "0px",
            "border_radius": "8px",
            "animation": "none",
            "icon": "arrow",
        },
        "form_style": {
            "bg_color": "#ffffff",
            "text_color": "#333333",
            "header_text_color": "#111111",
            "label_color": "#555555",
            "border_radius": "12px",
            "max_width": "480px",
            "overlay_opacity": "0.5",
            "product_image_size": "80px",
            "accent_color": "#b5a1e0",
        },
        "bumps": {
            "enabled": True,
            "items": BUMPS,
        },
        "upsells": {
            "enabled": True,
            "default_product_ids": [10017622786377],  # Aspirator Nazal — popular product
            "product_mappings": {},
            "default_timer_duration": 60,
            "default_accept_text": "Da, adaugă la comandă!",
            "default_reject_text": "Nu, mulțumesc, finalizați comanda",
            "offers": [],
        },
        "prepaid": {
            "enabled": True,
            "button_text": "💳 Plată cu cardul",
            "discount_type": "percentage",
            "discount_value": 0,
            "discount_code": "",
            "discount_label": "",
        },
        "shipping": {
            "default_rate": "19.99",
            "free_threshold": 150,
            "province_rates": {},
            "rates": [],
        },
    }

    for section, data in configs.items():
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
        print(f"  {section}: saved")

    await conn.close()
    print("\nDone! Refresh PrietenBebe product page to see COD form.")


asyncio.run(main())
