"""Check PrietenBebe theme + products and set up COD form config."""

import asyncio
import json
import os

import asyncpg
import httpx
from cryptography.fernet import Fernet


async def main() -> None:
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    row = await conn.fetchrow(
        "SELECT access_token_encrypted FROM shops WHERE shop_domain = $1",
        "rmeai1-da.myshopify.com",
    )
    f = Fernet(os.environ["FERNET_KEY"].encode())
    token = f.decrypt(row["access_token_encrypted"].encode()).decode()

    shop = "rmeai1-da.myshopify.com"
    h = {"X-Shopify-Access-Token": token}

    async with httpx.AsyncClient(timeout=30) as c:
        # Get live theme
        r = await c.get(f"https://{shop}/admin/api/2025-01/themes.json", headers=h)
        themes = r.json().get("themes", [])
        live = next((t for t in themes if t["role"] == "main"), None)
        if not live:
            print("No live theme")
            return
        tid = live["id"]
        print(f"Theme: {live.get('name', '?')} ID: {tid}")

        # Check for cod-form assets
        for asset_key in [
            "sections/cod-form.liquid",
            "assets/cod-form.js",
            "assets/cod-form.css",
        ]:
            r = await c.get(
                f"https://{shop}/admin/api/2025-01/themes/{tid}/assets.json",
                params={"asset[key]": asset_key},
                headers=h,
            )
            if r.status_code == 200:
                val = r.json().get("asset", {}).get("value", "")
                print(f"  {asset_key}: EXISTS ({len(val)} chars)")
            else:
                print(f"  {asset_key}: NOT FOUND")

        # Get products
        r = await c.get(
            f"https://{shop}/admin/api/2025-01/products.json?status=active&limit=50",
            headers=h,
        )
        products = r.json().get("products", [])
        print(f"\nActive products ({len(products)}):")
        for p in products:
            v = p["variants"][0]
            img = p.get("image")
            img_url = img.get("src", "") if img else ""
            print(
                f"  PID:{p['id']} VID:{v['id']} "
                f"Price:{v['price']} RON | {p['title'][:60]} | "
                f"img={'Y' if img_url else 'N'}"
            )

    await conn.close()


asyncio.run(main())
