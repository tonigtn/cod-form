"""Fix PrietenBebe bumps — correct variant IDs and images."""

import asyncio
import json
import os

import asyncpg
import httpx
from cryptography.fernet import Fernet

SHOP = "rmeai1-da.myshopify.com"

# Correct mapping: bump name → variant_id
CORRECT_BUMPS = [
    {"variant_id": 53701895389513, "title": "Set Diversificare", "price": "84.99"},
    {"variant_id": 51539040469321, "title": "Protecții Colțuri", "price": "30.00"},
    {"variant_id": 52673071055177, "title": "Siguranțe Uși", "price": "40.00"},
    {"variant_id": 51759157346633, "title": "Cască Protecție", "price": "80.00"},
    {"variant_id": 53602629353801, "title": "Pieptăn Cruste", "price": "30.00"},
]


async def main() -> None:
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    row = await conn.fetchrow(
        "SELECT access_token_encrypted FROM shops WHERE shop_domain = $1", SHOP
    )
    f = Fernet(os.environ["FERNET_KEY"].encode())
    token = f.decrypt(row["access_token_encrypted"].encode()).decode()

    h = {"X-Shopify-Access-Token": token}

    # Get product images
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(
            f"https://{SHOP}/admin/api/2025-01/products.json?status=active&limit=50",
            headers=h,
        )
        products = r.json().get("products", [])

    variant_to_product: dict[int, tuple[str, str]] = {}
    for p in products:
        img = p.get("image")
        img_url = img.get("src", "") if img else ""
        for v in p["variants"]:
            variant_to_product[v["id"]] = (p["title"], img_url)

    items = []
    for bump in CORRECT_BUMPS:
        vid = bump["variant_id"]
        product_title, img_url = variant_to_product.get(vid, ("?", ""))
        print(f"  {bump['title']} (VID:{vid}) → {product_title[:40]} img={'Y' if img_url else 'N'}")
        items.append({
            "variant_id": vid,
            "title": bump["title"],
            "price": bump["price"],
            "image_url": img_url,
            "text": f"Adaugă <b>{product_title[:40]}</b> la doar <b>{bump['price']} lei</b>",
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
        })

    config = {"enabled": True, "items": items}
    await conn.execute(
        """UPDATE shop_configs SET config = $1::jsonb, updated_at = NOW()
           WHERE shop_id = 1 AND section = 'bumps'""",
        json.dumps(config),
    )
    print("Done!")
    await conn.close()


asyncio.run(main())
