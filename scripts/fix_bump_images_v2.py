"""Fix PrietenBebe bump images — verify variant→product mapping and update."""

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

    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(
            f"https://{SHOP}/admin/api/2025-01/products.json?status=active&limit=50",
            headers=h,
        )
        products = r.json().get("products", [])

    # Build variant_id → (product_title, image_url)
    variant_map: dict[int, tuple[str, str]] = {}
    for p in products:
        img = p.get("image")
        img_url = img.get("src", "") if img else ""
        for v in p["variants"]:
            variant_map[v["id"]] = (p["title"], img_url)

    # Get current bumps
    config_row = await conn.fetchrow(
        "SELECT config FROM shop_configs WHERE shop_id = 1 AND section = 'bumps'"
    )
    bumps = config_row["config"] if config_row else {}
    if isinstance(bumps, str):
        bumps = json.loads(bumps)

    print("Current bump → product mapping:")
    for item in bumps.get("items", []):
        vid = item.get("variant_id")
        actual = variant_map.get(vid, ("UNKNOWN", ""))
        current_img = item.get("image_url", "")[:50]
        actual_img = actual[1][:50]
        match = "✓" if current_img and current_img == actual_img else "✗"
        print(f"  {match} Bump '{item['title']}' (VID:{vid})")
        print(f"    → Product: {actual[0]}")
        print(f"    → Current img: {current_img}")
        print(f"    → Correct img: {actual_img}")

        # Fix image
        item["image_url"] = actual[1]

        # Also update text to match BebeMate style: "Adaugă <b>Title</b> la doar <b>Price lei</b>"
        price = item.get("price", "0")
        item["text"] = f"Adaugă <b>{actual[0][:40]}</b> la doar <b>{price} lei</b>"

    await conn.execute(
        """UPDATE shop_configs SET config = $1::jsonb, updated_at = NOW()
           WHERE shop_id = 1 AND section = 'bumps'""",
        json.dumps(bumps),
    )
    print("\nFixed!")
    await conn.close()


asyncio.run(main())
