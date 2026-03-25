"""Push theme section with zero translation dependencies — all labels from JS."""

import asyncio
import os
import re

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

    h = {"X-Shopify-Access-Token": token, "Content-Type": "application/json"}

    # Read extension liquid
    with open("extensions/cod-form/blocks/cod-form-embed.liquid") as fl:
        ext = fl.read()

    # Strip ALL {{ 'xxx' | t }} translation calls — replace with empty string
    ext = re.sub(r"\{\{\s*'[^']*'\s*\|\s*t\s*\}\}", "", ext)

    # Replace block.settings with section.settings
    ext = ext.replace("block.settings.", "section.settings.")

    # Replace schema block with simple theme section schema
    schema_start = ext.index("{% schema %}")
    body = ext[:schema_start]
    body += '{% schema %}\n{"name": "COD Order Form", "settings": []}\n{% endschema %}\n'

    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.put(
            "https://rmeai1-da.myshopify.com/admin/api/2025-01/themes/182042198345/assets.json",
            headers=h,
            json={"asset": {"key": "sections/cod-form.liquid", "value": body}},
        )
        print(f"Push: {r.status_code}")
        if r.status_code != 200:
            print(r.text[:300])
        else:
            print("Done — no translation dependencies")


asyncio.run(main())
