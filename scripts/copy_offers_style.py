"""Copy BebeMate offers_style to PrietenBebe and set show_in=form."""

import asyncio
import json
import os

import asyncpg


async def main() -> None:
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])

    # Get BebeMate offers_style
    row = await conn.fetchrow(
        "SELECT config FROM shop_configs WHERE shop_id = 4 AND section = $1",
        "offers_style",
    )
    bb = row["config"] if row else {}
    if isinstance(bb, str):
        bb = json.loads(bb)
    print(f"BebeMate: show_in={bb.get('show_in')}, template={bb.get('template')}")

    # Force show_in=form for PrietenBebe
    bb["show_in"] = "form"

    await conn.execute(
        """INSERT INTO shop_configs (shop_id, section, config) VALUES (1, $1, $2::jsonb)
           ON CONFLICT (shop_id, section) DO UPDATE SET config = $2::jsonb, updated_at = NOW()""",
        "offers_style",
        json.dumps(bb),
    )
    print("Copied to PrietenBebe with show_in=form")
    await conn.close()


asyncio.run(main())
