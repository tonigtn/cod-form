"""Fix upsell discount to 40 RON for PrietenBebe."""

import asyncio
import json
import os

import asyncpg


async def main() -> None:
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])

    config = {
        "enabled": True,
        "default_product_ids": [9762614968649],
        "product_mappings": {},
        "default_timer_duration": 60,
        "default_accept_text": "Da, adaugă la comandă!",
        "default_reject_text": "Nu, mulțumesc, finalizați comanda",
        "offers": [
            {
                "product_id": 9762614968649,
                "header_text": "",
                "subheader_text": "",
                "discount_badge_text": "- 40 RON",
                "timer_duration": 60,
                "accept_text": "Da, adaugă la comandă!",
                "accept_color": "",
                "reject_text": "Nu, mulțumesc, finalizați comanda",
            }
        ],
    }

    await conn.execute(
        """UPDATE shop_configs SET config = $1::jsonb, updated_at = NOW()
           WHERE shop_id = 1 AND section = 'upsells'""",
        json.dumps(config),
    )
    print("Upsell updated with 40 RON discount badge")
    await conn.close()


asyncio.run(main())
