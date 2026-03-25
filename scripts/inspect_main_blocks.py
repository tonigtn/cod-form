"""List all blocks in main-product section and find the COD form extension."""

import asyncio
import json
import os

import asyncpg
import httpx
from cryptography.fernet import Fernet

SHOP = "rmeai1-da.myshopify.com"
TID = 182042198345
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
        tkey = f"templates/product.{HANDLE}.json"
        r = await c.get(
            f"https://{SHOP}/admin/api/2025-01/themes/{TID}/assets.json",
            params={"asset[key]": tkey},
            headers=h,
        )
        template = json.loads(r.json()["asset"]["value"])

        main_section = template.get("sections", {}).get("main", {})
        blocks = main_section.get("blocks", {})
        block_order = main_section.get("block_order", [])

        print(f"Main section blocks ({len(blocks)}):")
        print(f"Block order: {block_order}\n")

        for bk in block_order:
            bv = blocks.get(bk, {})
            btype = bv.get("type", "?")
            settings = bv.get("settings", {})
            marker = " ***" if "cod" in btype.lower() else ""
            print(f"  {bk}: {btype}{marker}")
            if settings and "cod" in btype.lower():
                print(f"    settings: {json.dumps(settings, indent=6)}")


asyncio.run(main())
