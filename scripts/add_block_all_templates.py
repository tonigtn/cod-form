"""Add COD form app block to main-product section of ALL product templates."""

import asyncio
import json
import os

import asyncpg
import httpx
from cryptography.fernet import Fernet

SHOP = "rmeai1-da.myshopify.com"
THEME = 182042198345
# Extension UUID from the deployed extension
# Find it from any working template (genunchere)
COD_BLOCK_TYPE = "shopify://apps/cod-form-prietenbebe/blocks/cod-form-embed/279c058d-e2b0-785d-0abc-9c4482a708772fe4d69a"


async def main() -> None:
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    row = await conn.fetchrow(
        "SELECT access_token_encrypted FROM shops WHERE shop_domain = $1", SHOP
    )
    f = Fernet(os.environ["FERNET_KEY"].encode())
    token = f.decrypt(row["access_token_encrypted"].encode()).decode()
    await conn.close()

    h = {"X-Shopify-Access-Token": token, "Content-Type": "application/json"}
    actual_block_type = COD_BLOCK_TYPE
    actual_block_settings = {}

    async with httpx.AsyncClient(timeout=30) as c:

        # Get all product templates
        r = await c.get(
            f"https://{SHOP}/admin/api/2025-01/themes/{THEME}/assets.json",
            headers=h,
        )
        all_assets = r.json().get("assets", [])
        product_templates = [a["key"] for a in all_assets if a["key"].startswith("templates/product") and a["key"].endswith(".json")]
        print(f"\nFound {len(product_templates)} product templates")

        for tpl_key in product_templates:
            r = await c.get(
                f"https://{SHOP}/admin/api/2025-01/themes/{THEME}/assets.json",
                params={"asset[key]": tpl_key},
                headers=h,
            )
            if r.status_code != 200:
                continue
            tpl = json.loads(r.json()["asset"]["value"])

            # Find main section
            main_key = None
            for sk, sv in tpl.get("sections", {}).items():
                if sv.get("type", "") in ("main-product", "main"):
                    main_key = sk
                    break
            if not main_key:
                print(f"  SKIP {tpl_key}: no main-product section")
                continue

            main_sec = tpl["sections"][main_key]
            blocks = main_sec.get("blocks", {})

            # Check if COD form block already exists
            has_cod = any("cod-form" in bv.get("type", "").lower() for bv in blocks.values())
            if has_cod:
                print(f"  OK   {tpl_key}: already has COD form")
                continue

            # Add COD form block
            block_id = "cod_form_block"
            blocks[block_id] = {
                "type": actual_block_type,
                "settings": actual_block_settings,
            }

            # Add to block_order (after buy_buttons if possible)
            block_order = main_sec.get("block_order", list(blocks.keys()))
            if block_id not in block_order:
                # Insert after buy_buttons or at end
                insert_at = len(block_order)
                for i, bo in enumerate(block_order):
                    if "buy" in bo.lower() or "buy" in blocks.get(bo, {}).get("type", "").lower():
                        insert_at = i + 1
                        break
                block_order.insert(insert_at, block_id)
                main_sec["block_order"] = block_order

            # Push
            r = await c.put(
                f"https://{SHOP}/admin/api/2025-01/themes/{THEME}/assets.json",
                headers=h,
                json={"asset": {"key": tpl_key, "value": json.dumps(tpl, indent=2)}},
            )
            status = "OK" if r.status_code == 200 else f"FAIL({r.status_code})"
            print(f"  ADD  {tpl_key}: {status}")

    print("\nDone!")


asyncio.run(main())
