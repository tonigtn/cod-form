"""Fix PrietenBebe bump images — fetch from Shopify and update DB."""

import asyncio
import json
import os

import asyncpg
import httpx
from cryptography.fernet import Fernet

SHOP = "rmeai1-da.myshopify.com"


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

    # Build variant_id → image_url map
    img_map: dict[int, str] = {}
    for p in products:
        img = p.get("image")
        img_url = img.get("src", "") if img else ""
        for v in p["variants"]:
            img_map[v["id"]] = img_url

    # Get current bumps config
    config_row = await conn.fetchrow(
        "SELECT config FROM shop_configs WHERE shop_id = 1 AND section = 'bumps'"
    )
    bumps = config_row["config"] if config_row else {}
    if isinstance(bumps, str):
        bumps = json.loads(bumps)

    # Update image_url for each bump item
    for item in bumps.get("items", []):
        vid = item.get("variant_id")
        if vid and vid in img_map:
            item["image_url"] = img_map[vid]
            print(f"  {item['title']}: {img_map[vid][:60]}...")

    # Save back
    await conn.execute(
        """UPDATE shop_configs SET config = $1::jsonb, updated_at = NOW()
           WHERE shop_id = 1 AND section = 'bumps'""",
        json.dumps(bumps),
    )
    print("Done!")
    await conn.close()


asyncio.run(main())
