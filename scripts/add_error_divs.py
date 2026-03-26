"""Add error divs to the PrietenBebe theme section liquid."""

import asyncio
import os

import asyncpg
import httpx
from cryptography.fernet import Fernet

SHOP = "rmeai1-da.myshopify.com"
THEME = 182042198345

# Field name → add error div after each input
FIELDS = ["first_name", "last_name", "phone", "province", "city", "address1", "zip", "email"]


async def main() -> None:
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    row = await conn.fetchrow(
        "SELECT access_token_encrypted FROM shops WHERE shop_domain = $1", SHOP
    )
    f = Fernet(os.environ["FERNET_KEY"].encode())
    token = f.decrypt(row["access_token_encrypted"].encode()).decode()
    await conn.close()

    h = {"X-Shopify-Access-Token": token, "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(
            f"https://{SHOP}/admin/api/2025-01/themes/{THEME}/assets.json",
            params={"asset[key]": "sections/cod-form.liquid"},
            headers=h,
        )
        liquid = r.json()["asset"]["value"]

        # Add error divs after each </input> or </select> within data-field divs
        for field in FIELDS:
            error_div = f'<div class="cod-form__error" data-error="{field}"></div>'
            # Check if already has error div
            if f'data-error="{field}"' in liquid:
                continue
            # Find the closing </div> of the field wrapper
            marker = f'data-field="{field}"'
            idx = liquid.find(marker)
            if idx == -1:
                continue
            # Find the closing </div> of this field
            close_idx = liquid.find("</div>", idx)
            if close_idx == -1:
                continue
            # Insert error div before the closing </div>
            liquid = liquid[:close_idx] + f"\n          {error_div}\n        " + liquid[close_idx:]

        r = await c.put(
            f"https://{SHOP}/admin/api/2025-01/themes/{THEME}/assets.json",
            headers=h,
            json={"asset": {"key": "sections/cod-form.liquid", "value": liquid}},
        )
        print(f"Push: {r.status_code}")
        # Verify
        count = liquid.count('data-error=')
        print(f"Error divs: {count}")


asyncio.run(main())
