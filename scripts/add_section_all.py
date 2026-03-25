"""Add cod-form SECTION to ALL product templates (same approach as genunchere)."""

import asyncio
import json
import os

import asyncpg
import httpx
from cryptography.fernet import Fernet

SHOP = "rmeai1-da.myshopify.com"
THEME = 182042198345

COD_SECTION = {
    "type": "cod-form",
    "settings": {
        "store_id": "store_1",
        "cod_api_url": "https://api.magazinultarii.ro",
    },
}


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
        all_assets = r.json().get("assets", [])
        templates = [
            a["key"]
            for a in all_assets
            if a["key"].startswith("templates/product") and a["key"].endswith(".json")
        ]
        print(f"Found {len(templates)} product templates\n")

        for tpl_key in templates:
            r = await c.get(
                f"https://{SHOP}/admin/api/2025-01/themes/{THEME}/assets.json",
                params={"asset[key]": tpl_key},
                headers=h,
            )
            if r.status_code != 200:
                continue

            tpl = json.loads(r.json()["asset"]["value"])
            sections = tpl.get("sections", {})

            # Skip if already has cod-form section
            if "cod-form" in sections:
                print(f"  OK   {tpl_key}")
                continue

            # Add cod-form section
            sections["cod-form"] = COD_SECTION

            # Add to order — after main section
            order = tpl.get("order", list(sections.keys()))
            if "cod-form" not in order:
                insert_at = len(order)
                for i, s in enumerate(order):
                    if "main" in s.lower():
                        insert_at = i + 1
                        break
                order.insert(insert_at, "cod-form")
                tpl["order"] = order

            # Also remove the bad app block we added earlier
            for sk, sv in sections.items():
                blocks = sv.get("blocks", {})
                bad = [bk for bk, bv in blocks.items() if bk == "cod_form_block"]
                for bk in bad:
                    del blocks[bk]
                    bo = sv.get("block_order", [])
                    if bk in bo:
                        bo.remove(bk)

            r = await c.put(
                f"https://{SHOP}/admin/api/2025-01/themes/{THEME}/assets.json",
                headers=h,
                json={"asset": {"key": tpl_key, "value": json.dumps(tpl, indent=2)}},
            )
            status = "OK" if r.status_code == 200 else f"FAIL({r.status_code})"
            print(f"  ADD  {tpl_key}: {status}")

    print("\nDone!")


asyncio.run(main())
