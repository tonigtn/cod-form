"""Add the COD form app block to main section of ALL product templates."""

import asyncio
import json
import os

import asyncpg
import httpx
from cryptography.fernet import Fernet

SHOP = "rmeai1-da.myshopify.com"
THEME = 182042198345
BLOCK_TYPE = "shopify://apps/cod-form-prietenbebe/blocks/cod-form-embed/019d1d2f-b7fe-7287-8c9b-4997278fb0c5"


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
        # Get all templates
        r = await c.get(
            f"https://{SHOP}/admin/api/2025-01/themes/{THEME}/assets.json",
            headers=h,
        )
        templates = [
            a["key"]
            for a in r.json().get("assets", [])
            if a["key"].startswith("templates/product") and a["key"].endswith(".json")
        ]
        print(f"Found {len(templates)} templates\n")

        for tpl_key in templates:
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
                print(f"  SKIP {tpl_key}: no main section")
                continue

            main_sec = tpl["sections"][main_key]
            blocks = main_sec.setdefault("blocks", {})
            block_order = main_sec.setdefault("block_order", list(blocks.keys()))

            # Check if already has COD block
            has_cod = any("cod-form" in bv.get("type", "").lower() for bv in blocks.values())
            if has_cod:
                print(f"  OK   {tpl_key}")
                continue

            # Add block — position before inventory if exists, else after buy_buttons
            block_id = "cod_form_app_block"
            blocks[block_id] = {"type": BLOCK_TYPE, "settings": {}}

            insert_at = len(block_order)
            for i, bo in enumerate(block_order):
                bt = blocks.get(bo, {}).get("type", "")
                if "inventory" in bt.lower() or "inventory" in bo.lower():
                    insert_at = i
                    break
            # Fallback: after buy_buttons
            if insert_at == len(block_order):
                for i, bo in enumerate(block_order):
                    bt = blocks.get(bo, {}).get("type", "")
                    if "buy" in bt.lower() or "buy" in bo.lower():
                        insert_at = i + 1
                        break
            block_order.insert(insert_at, block_id)

            r = await c.put(
                f"https://{SHOP}/admin/api/2025-01/themes/{THEME}/assets.json",
                headers=h,
                json={"asset": {"key": tpl_key, "value": json.dumps(tpl, indent=2)}},
            )
            s = "OK" if r.status_code == 200 else f"FAIL({r.status_code})"
            print(f"  ADD  {tpl_key}: {s}")

    print("\nDone!")


asyncio.run(main())
