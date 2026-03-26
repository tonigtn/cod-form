"""Fix: biberon should only show its own 2x -25% offer, not default offers."""

import asyncio
import json
import os

import asyncpg

BOTTLE_PID = 10098792497481


async def main() -> None:
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])

    offer_groups = [
        {
            "name": "Default Offer",
            "product_ids": [],
            "enabled": True,
            "exclude_product_ids": [BOTTLE_PID],  # Exclude biberon from defaults
            "tiers": [
                {
                    "min_qty": 2, "title": "2 bucăți", "discount_type": "percentage",
                    "discount_percent": 10, "discount_fixed": 0, "tag": "-10%",
                    "tag_bg": "#C62828", "label": "Cumpără 2 — 10% reducere",
                    "image_url": "", "preselect": False,
                },
                {
                    "min_qty": 3, "title": "3 bucăți", "discount_type": "percentage",
                    "discount_percent": 15, "discount_fixed": 0, "tag": "-15%",
                    "tag_bg": "#2E7D32", "label": "Cumpără 3 — 15% reducere",
                    "image_url": "", "preselect": False,
                },
            ],
        },
        {
            "name": "Biberon Hands-Free",
            "product_ids": [BOTTLE_PID],
            "enabled": True,
            "tiers": [
                {
                    "min_qty": 2, "title": "2 Biberoane", "discount_type": "percentage",
                    "discount_percent": 25, "discount_fixed": 0, "tag": "-25%",
                    "tag_bg": "#b5a1e0", "label": "Popular",
                    "image_url": "", "preselect": True,
                },
            ],
        },
    ]

    await conn.execute(
        """INSERT INTO shop_configs (shop_id, section, config) VALUES (1, 'offer_groups', $1::jsonb)
           ON CONFLICT (shop_id, section) DO UPDATE SET config = $1::jsonb, updated_at = NOW()""",
        json.dumps(offer_groups),
    )
    print("Done — biberon only shows 2x -25%, excluded from defaults")
    await conn.close()


asyncio.run(main())
