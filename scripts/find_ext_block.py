"""Find and remove COD form extension blocks from PrietenBebe genunchere template."""

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

        # Search every section + block for COD form extension
        changed = False
        for sk, sv in template.get("sections", {}).items():
            # Check if the section itself is an apps section with COD blocks
            stype = sv.get("type", "")
            blocks = sv.get("blocks", {})

            for bk, bv in list(blocks.items()):
                btype = bv.get("type", "")
                if "cod" in btype.lower() and "shopify://" in btype:
                    print(f"FOUND: section={sk} block={bk} type={btype}")
                    del blocks[bk]
                    if "block_order" in sv and bk in sv["block_order"]:
                        sv["block_order"].remove(bk)
                    changed = True
                elif "cod" in btype.lower():
                    print(f"FOUND (non-ext): section={sk} block={bk} type={btype}")

            # Also check section type itself
            if "cod" in stype.lower() and "shopify://" in stype:
                print(f"FOUND section: {sk} type={stype}")

        # Also check if there's an "apps" section with COD form
        for sk, sv in list(template.get("sections", {}).items()):
            if sv.get("type") == "apps":
                for bk, bv in list(sv.get("blocks", {}).items()):
                    btype = bv.get("type", "")
                    if "cod" in btype.lower():
                        print(f"FOUND in apps section: {sk} block={bk} type={btype}")
                        del sv["blocks"][bk]
                        if "block_order" in sv and bk in sv["block_order"]:
                            sv["block_order"].remove(bk)
                        changed = True

        if changed:
            r = await c.put(
                f"https://{SHOP}/admin/api/2025-01/themes/{TID}/assets.json",
                headers=h,
                json={"asset": {"key": tkey, "value": json.dumps(template, indent=2)}},
            )
            print(f"Updated: {r.status_code}")
        else:
            print("No extension COD blocks found in template")
            print("\nChecking default product template...")
            r = await c.get(
                f"https://{SHOP}/admin/api/2025-01/themes/{TID}/assets.json",
                params={"asset[key]": "templates/product.json"},
                headers=h,
            )
            default = json.loads(r.json()["asset"]["value"])
            for sk, sv in default.get("sections", {}).items():
                for bk, bv in sv.get("blocks", {}).items():
                    btype = bv.get("type", "")
                    if "cod" in btype.lower():
                        print(f"DEFAULT TEMPLATE: section={sk} block={bk} type={btype}")


asyncio.run(main())
