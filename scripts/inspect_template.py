"""Inspect the PrietenBebe genunchere template and remove extension blocks."""

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

        print("Current sections:")
        for k, v in template.get("sections", {}).items():
            stype = v.get("type", "?")
            blocks = v.get("blocks", {})
            print(f"  {k}: type={stype} ({len(blocks)} blocks)")
            for bk, bv in blocks.items():
                btype = bv.get("type", "?")
                if "cod" in btype.lower() or "easysell" in btype.lower():
                    print(f"    *** {bk}: type={btype}")
                elif "shopify://" in btype:
                    print(f"    ext {bk}: {btype}")

        # Find and remove the extension-based COD form blocks, keep theme section
        changed = False
        for section_key, section in list(template.get("sections", {}).items()):
            blocks = section.get("blocks", {})
            to_remove = []
            for bk, bv in blocks.items():
                btype = bv.get("type", "")
                # Remove extension-based COD form blocks
                if "cod-form" in btype and "shopify://" in btype:
                    to_remove.append(bk)
                    print(f"\n  REMOVING extension block: {bk} ({btype})")
            for bk in to_remove:
                del blocks[bk]
                # Also remove from block_order if present
                if "block_order" in section and bk in section["block_order"]:
                    section["block_order"].remove(bk)
                changed = True

        if changed:
            r = await c.put(
                f"https://{SHOP}/admin/api/2025-01/themes/{TID}/assets.json",
                headers=h,
                json={"asset": {"key": tkey, "value": json.dumps(template, indent=2)}},
            )
            print(f"\nTemplate updated: {r.status_code}")
        else:
            print("\nNo extension blocks found to remove")

        # Verify theme section cod-form is present
        if "cod-form" in template.get("sections", {}):
            print("Theme cod-form section: PRESENT")
        else:
            print("Theme cod-form section: MISSING")


asyncio.run(main())
