"""Add COD form section to the genunchere product page only."""

import asyncio
import json
import os

import asyncpg
import httpx
from cryptography.fernet import Fernet

SHOP = "rmeai1-da.myshopify.com"
THEME_ID = 182042198345
HANDLE = "prietenbebe-genunchere-bebelusilor-3-pack"


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
        # Check if product-specific template exists
        template_key = f"templates/product.{HANDLE}.json"
        r = await c.get(
            f"https://{SHOP}/admin/api/2025-01/themes/{THEME_ID}/assets.json",
            params={"asset[key]": template_key},
            headers=h,
        )

        if r.status_code == 200:
            template = json.loads(r.json()["asset"]["value"])
            print(f"Existing template: {list(template.get('sections', {}).keys())}")
        else:
            # Clone from default product template
            r = await c.get(
                f"https://{SHOP}/admin/api/2025-01/themes/{THEME_ID}/assets.json",
                params={"asset[key]": "templates/product.json"},
                headers=h,
            )
            template = json.loads(r.json()["asset"]["value"])
            print(f"Cloned default template: {list(template.get('sections', {}).keys())}")

        # Add cod-form section
        template["sections"]["cod-form"] = {
            "type": "cod-form",
            "settings": {
                "store_id": "store_1",
                "cod_api_url": "https://api.magazinultarii.ro",
                "cod_api_key": "",
            },
        }

        # Add to section order
        if "order" in template:
            order = template["order"]
            if "cod-form" not in order:
                # Insert after the main product section
                insert_at = len(order)
                for i, s in enumerate(order):
                    if "main" in s.lower():
                        insert_at = i + 1
                        break
                order.insert(insert_at, "cod-form")

        # Push product-specific template
        r = await c.put(
            f"https://{SHOP}/admin/api/2025-01/themes/{THEME_ID}/assets.json",
            headers=h,
            json={"asset": {"key": template_key, "value": json.dumps(template, indent=2)}},
        )
        print(f"Push {template_key}: {r.status_code}")
        if r.status_code != 200:
            print(r.text[:300])
        else:
            print("Done! COD form added to genunchere product.")


asyncio.run(main())
