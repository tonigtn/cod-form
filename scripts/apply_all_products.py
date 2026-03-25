"""Apply COD form to ALL PrietenBebe products, remove EasySell, copy BebeMate configs."""

import asyncio
import json
import os

import asyncpg
import httpx
from cryptography.fernet import Fernet

PB_SHOP = "rmeai1-da.myshopify.com"
BB_SHOP = "jgj1ff-ak.myshopify.com"
PB_THEME = 182042198345

# PrietenBebe product IDs
PILLOW_PID = 9762614968649  # Pernă Anti Aplatizare — IS the upsell, shouldn't upsell itself
BOTTLE_PID = 10098792497481  # Biberon Hands-Free


async def main() -> None:
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])

    # Get PrietenBebe token
    row = await conn.fetchrow(
        "SELECT access_token_encrypted FROM shops WHERE shop_domain = $1", PB_SHOP
    )
    f = Fernet(os.environ["FERNET_KEY"].encode())
    pb_token = f.decrypt(row["access_token_encrypted"].encode()).decode()
    pb_headers = {"X-Shopify-Access-Token": pb_token, "Content-Type": "application/json"}

    # ── Step 1: Get BebeMate's offer_groups config ──
    print("=== Step 1: Get BebeMate configs ===")
    bb_row = await conn.fetchrow(
        "SELECT config FROM shop_configs WHERE shop_id = 4 AND section = 'offer_groups'"
    )
    bb_offers = bb_row["config"] if bb_row else []
    if isinstance(bb_offers, str):
        bb_offers = json.loads(bb_offers)
    print(f"  BebeMate offer_groups: {len(bb_offers)} groups")

    bb_upsell_row = await conn.fetchrow(
        "SELECT config FROM shop_configs WHERE shop_id = 4 AND section = 'upsells'"
    )
    bb_upsells = bb_upsell_row["config"] if bb_upsell_row else {}
    if isinstance(bb_upsells, str):
        bb_upsells = json.loads(bb_upsells)
    print(f"  BebeMate upsells: product_mappings={len(bb_upsells.get('product_mappings', {}))}")

    # ── Step 2: Create PrietenBebe offer_groups (same structure, PB products) ──
    print("\n=== Step 2: Set PrietenBebe offer_groups ===")
    pb_offer_groups = [
        {
            "name": "Default Offer",
            "product_ids": [],  # empty = all products
            "enabled": True,
            "tiers": [
                {
                    "min_qty": 2,
                    "title": "2 bucăți",
                    "discount_type": "percentage",
                    "discount_percent": 10,
                    "discount_fixed": 0,
                    "tag": "-10%",
                    "tag_bg": "#C62828",
                    "label": "Cumpără 2 — 10% reducere",
                    "image_url": "",
                    "preselect": False,
                },
                {
                    "min_qty": 3,
                    "title": "3 bucăți",
                    "discount_type": "percentage",
                    "discount_percent": 15,
                    "discount_fixed": 0,
                    "tag": "-15%",
                    "tag_bg": "#2E7D32",
                    "label": "Cumpără 3 — 15% reducere",
                    "image_url": "",
                    "preselect": False,
                },
            ],
        }
    ]
    await conn.execute(
        """INSERT INTO shop_configs (shop_id, section, config)
           VALUES (1, 'offer_groups', $1::jsonb)
           ON CONFLICT (shop_id, section) DO UPDATE SET config = $1::jsonb, updated_at = NOW()""",
        json.dumps(pb_offer_groups),
    )
    print(f"  Saved offer_groups: {len(pb_offer_groups)} groups")

    # ── Step 3: Update upsells with product_mappings ──
    print("\n=== Step 3: Update upsells ===")
    # Pillow should NOT upsell itself — use a different product (e.g., Aspirator Nazal)
    aspirator_pid = 10017622786377
    pb_upsells = {
        "enabled": True,
        "default_product_ids": [PILLOW_PID],  # Default upsell = pillow
        "product_mappings": {
            str(PILLOW_PID): [aspirator_pid],  # Pillow → upsell Aspirator instead
        },
        "default_timer_duration": 60,
        "default_accept_text": "Da, adaugă la comandă!",
        "default_reject_text": "Nu, mulțumesc, finalizați comanda",
        "offers": [
            {
                "product_id": PILLOW_PID,
                "header_text": "",
                "subheader_text": "",
                "discount_badge_text": "- 40 RON",
                "timer_duration": 60,
                "accept_text": "Da, adaugă la comandă!",
                "accept_color": "",
                "reject_text": "Nu, mulțumesc, finalizați comanda",
            },
            {
                "product_id": aspirator_pid,
                "header_text": "",
                "subheader_text": "",
                "discount_badge_text": "- 30 RON",
                "timer_duration": 60,
                "accept_text": "Da, adaugă la comandă!",
                "accept_color": "",
                "reject_text": "Nu, mulțumesc, finalizați comanda",
            },
        ],
    }
    await conn.execute(
        """UPDATE shop_configs SET config = $1::jsonb, updated_at = NOW()
           WHERE shop_id = 1 AND section = 'upsells'""",
        json.dumps(pb_upsells),
    )
    print(f"  Default upsell: Pernă Anti Aplatizare")
    print(f"  Pillow→Aspirator mapping set (no self-upsell)")

    # ── Step 4: Add COD form to DEFAULT product template + remove EasySell ──
    print("\n=== Step 4: Update default product template ===")
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(
            f"https://{PB_SHOP}/admin/api/2025-01/themes/{PB_THEME}/assets.json",
            params={"asset[key]": "templates/product.json"},
            headers=pb_headers,
        )
        template = json.loads(r.json()["asset"]["value"])

        # Remove EasySell blocks from all sections
        easysell_removed = 0
        for sk, sv in template.get("sections", {}).items():
            blocks = sv.get("blocks", {})
            to_remove = []
            for bk, bv in blocks.items():
                btype = bv.get("type", "")
                if "easysell" in btype.lower():
                    to_remove.append(bk)
            for bk in to_remove:
                del blocks[bk]
                if "block_order" in sv and bk in sv["block_order"]:
                    sv["block_order"].remove(bk)
                easysell_removed += 1

        print(f"  Removed {easysell_removed} EasySell blocks from default template")

        # Add COD form section if not present
        if "cod-form" not in template.get("sections", {}):
            template["sections"]["cod-form"] = {
                "type": "cod-form",
                "settings": {
                    "store_id": "store_1",
                    "cod_api_url": "https://api.magazinultarii.ro",
                },
            }
            if "order" in template:
                order = template["order"]
                # Insert after main section
                insert_at = len(order)
                for i, s in enumerate(order):
                    if "main" in s.lower():
                        insert_at = i + 1
                        break
                order.insert(insert_at, "cod-form")
            print("  Added cod-form section to default template")
        else:
            print("  cod-form section already in default template")

        # Push default template
        r = await c.put(
            f"https://{PB_SHOP}/admin/api/2025-01/themes/{PB_THEME}/assets.json",
            headers=pb_headers,
            json={"asset": {"key": "templates/product.json", "value": json.dumps(template, indent=2)}},
        )
        print(f"  Default template push: {r.status_code}")

        # ── Step 5: Also update genunchere-specific template ──
        print("\n=== Step 5: Clean genunchere template ===")
        gen_key = "templates/product.prietenbebe-genunchere-bebelusilor-3-pack.json"
        r = await c.get(
            f"https://{PB_SHOP}/admin/api/2025-01/themes/{PB_THEME}/assets.json",
            params={"asset[key]": gen_key},
            headers=pb_headers,
        )
        if r.status_code == 200:
            gen_template = json.loads(r.json()["asset"]["value"])
            # Remove EasySell from genunchere too
            es_removed = 0
            for sk, sv in gen_template.get("sections", {}).items():
                blocks = sv.get("blocks", {})
                to_remove = [bk for bk, bv in blocks.items() if "easysell" in bv.get("type", "").lower()]
                for bk in to_remove:
                    del blocks[bk]
                    if "block_order" in sv and bk in sv["block_order"]:
                        sv["block_order"].remove(bk)
                    es_removed += 1
            if es_removed:
                r = await c.put(
                    f"https://{PB_SHOP}/admin/api/2025-01/themes/{PB_THEME}/assets.json",
                    headers=pb_headers,
                    json={"asset": {"key": gen_key, "value": json.dumps(gen_template, indent=2)}},
                )
                print(f"  Removed {es_removed} EasySell blocks, push: {r.status_code}")
            else:
                print("  No EasySell blocks in genunchere template")

        # ── Step 6: List all product-specific templates and clean them too ──
        print("\n=== Step 6: Clean all product templates ===")
        r = await c.get(
            f"https://{PB_SHOP}/admin/api/2025-01/themes/{PB_THEME}/assets.json",
            headers=pb_headers,
        )
        all_assets = r.json().get("assets", [])
        product_templates = [
            a["key"] for a in all_assets
            if a["key"].startswith("templates/product.") and a["key"].endswith(".json")
            and a["key"] != "templates/product.json"
        ]
        print(f"  Found {len(product_templates)} product-specific templates")
        for tpl_key in product_templates:
            r = await c.get(
                f"https://{PB_SHOP}/admin/api/2025-01/themes/{PB_THEME}/assets.json",
                params={"asset[key]": tpl_key},
                headers=pb_headers,
            )
            if r.status_code != 200:
                continue
            tpl = json.loads(r.json()["asset"]["value"])
            changed = False
            for sk, sv in tpl.get("sections", {}).items():
                blocks = sv.get("blocks", {})
                to_remove = [bk for bk, bv in blocks.items() if "easysell" in bv.get("type", "").lower()]
                for bk in to_remove:
                    del blocks[bk]
                    if "block_order" in sv and bk in sv["block_order"]:
                        sv["block_order"].remove(bk)
                    changed = True
            if changed:
                await c.put(
                    f"https://{PB_SHOP}/admin/api/2025-01/themes/{PB_THEME}/assets.json",
                    headers=pb_headers,
                    json={"asset": {"key": tpl_key, "value": json.dumps(tpl, indent=2)}},
                )
                print(f"    Cleaned: {tpl_key}")

    await conn.close()
    print("\n=== DONE ===")
    print("COD form on all products, EasySell removed, offers + upsells configured.")


asyncio.run(main())
