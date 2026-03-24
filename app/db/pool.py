"""asyncpg connection pool — created on app startup, closed on shutdown."""

from __future__ import annotations

from typing import Any

import asyncpg
import structlog

from app.config import get_database_url

log = structlog.get_logger(__name__)

_pool: asyncpg.Pool[asyncpg.Record] | None = None


async def init_pool() -> None:
    """Create the connection pool. Called during app lifespan startup."""
    global _pool  # noqa: PLW0603
    url = get_database_url()
    _pool = await asyncpg.create_pool(url, min_size=2, max_size=10)
    log.info("db_pool_created")


async def close_pool() -> None:
    """Close the connection pool. Called during app lifespan shutdown."""
    global _pool  # noqa: PLW0603
    if _pool:
        await _pool.close()
        _pool = None
        log.info("db_pool_closed")


def get_pool() -> asyncpg.Pool[asyncpg.Record]:
    """Get the active connection pool. Raises if not initialized."""
    if _pool is None:
        msg = "Database pool not initialized — call init_pool() first"
        raise RuntimeError(msg)
    return _pool


async def execute(query: str, *args: Any) -> str:
    """Execute a query (INSERT, UPDATE, DELETE). Returns status string."""
    pool = get_pool()
    return await pool.execute(query, *args)


async def fetch(query: str, *args: Any) -> list[asyncpg.Record]:
    """Fetch multiple rows."""
    pool = get_pool()
    return await pool.fetch(query, *args)


async def fetchrow(query: str, *args: Any) -> asyncpg.Record | None:
    """Fetch a single row."""
    pool = get_pool()
    return await pool.fetchrow(query, *args)


async def fetchval(query: str, *args: Any) -> Any:
    """Fetch a single value."""
    pool = get_pool()
    return await pool.fetchval(query, *args)
