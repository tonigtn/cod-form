"""Run all pending SQL migrations in order.

Usage: uv run python scripts/migrate.py
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

import asyncpg


async def main() -> None:
    url = os.environ.get(
        "DATABASE_URL",
        "postgresql://cod_form_user:cod_form_secure_2026@127.0.0.1:5432/cod_form",
    )
    conn = await asyncpg.connect(url)

    # Create migration tracking table if not exists
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS _migrations (
            name TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    # Get already-applied migrations
    applied = {
        r["name"]
        for r in await conn.fetch("SELECT name FROM _migrations")
    }

    # Find and run pending migrations
    migrations_dir = Path(__file__).resolve().parent.parent / "app" / "db" / "migrations"
    migration_files = sorted(migrations_dir.glob("*.sql"))

    for mf in migration_files:
        if mf.name in applied:
            print(f"  skip {mf.name} (already applied)")
            continue

        print(f"  apply {mf.name} ...")
        sql = mf.read_text()
        await conn.execute(sql)
        await conn.execute(
            "INSERT INTO _migrations (name) VALUES ($1)", mf.name
        )
        print(f"  done {mf.name}")

    await conn.close()
    print("\nAll migrations applied.")


if __name__ == "__main__":
    asyncio.run(main())
