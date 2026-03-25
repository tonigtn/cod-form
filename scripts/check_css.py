"""Verify the PrietenBebe theme CSS has the overrides."""

import asyncio
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
    await conn.close()

    h = {"X-Shopify-Access-Token": token}
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(
            "https://rmeai1-da.myshopify.com/admin/api/2025-01/themes/182042198345/assets.json",
            params={"asset[key]": "assets/cod-form.css"},
            headers=h,
        )
        css = r.json().get("asset", {}).get("value", "")
        print(f"CSS size: {len(css)}")
        print(f"Has overrides: {'Theme-independent' in css}")
        print(f"Has submit fix: {'#cod-submit-btn' in css}")
        print(f"Has form overlay: {'#cod-form-overlay .cod-form' in css}")


asyncio.run(main())
