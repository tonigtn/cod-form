"""Admin API: phone and IP blacklist management — DB-backed."""

from __future__ import annotations

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import pool
from app.session import SessionUser
from app.shopify.tokens import get_shop_id_or_raise

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/admin/blacklist", tags=["admin-blacklist"])


class BlacklistEntry(BaseModel, frozen=True):
    value: str


@router.get("/{bl_type}")
async def get_blacklist(bl_type: str, _user: SessionUser) -> dict[str, object]:
    """Return all entries in a blacklist."""
    if bl_type not in ("phones", "ips"):
        raise HTTPException(status_code=400, detail=f"Invalid type: {bl_type}")

    shop_id = await get_shop_id_or_raise(_user["shop"])
    db_type = "phone" if bl_type == "phones" else "ip"

    rows = await pool.fetch(
        "SELECT value FROM blacklists WHERE shop_id = $1 AND type = $2 ORDER BY value",
        shop_id,
        db_type,
    )
    return {"items": [r["value"] for r in rows], "type": bl_type}


@router.post("/{bl_type}")
async def add_to_blacklist(
    bl_type: str, entry: BlacklistEntry, _user: SessionUser
) -> dict[str, str]:
    """Add an entry to a blacklist."""
    if bl_type not in ("phones", "ips"):
        raise HTTPException(status_code=400, detail=f"Invalid type: {bl_type}")

    shop_id = await get_shop_id_or_raise(_user["shop"])
    db_type = "phone" if bl_type == "phones" else "ip"
    value = entry.value.strip()

    if not value:
        raise HTTPException(status_code=400, detail="Empty value")

    await pool.execute(
        """INSERT INTO blacklists (shop_id, type, value)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING""",
        shop_id,
        db_type,
        value,
    )
    log.info("cod_admin_blacklist_added", type=bl_type, value=value, shop=_user["shop"])
    return {"status": "ok"}


@router.delete("/{bl_type}")
async def remove_from_blacklist(
    bl_type: str, entry: BlacklistEntry, _user: SessionUser
) -> dict[str, str]:
    """Remove an entry from a blacklist."""
    if bl_type not in ("phones", "ips"):
        raise HTTPException(status_code=400, detail=f"Invalid type: {bl_type}")

    shop_id = await get_shop_id_or_raise(_user["shop"])
    db_type = "phone" if bl_type == "phones" else "ip"
    value = entry.value.strip()

    await pool.execute(
        "DELETE FROM blacklists WHERE shop_id = $1 AND type = $2 AND value = $3",
        shop_id,
        db_type,
        value,
    )
    log.info("cod_admin_blacklist_removed", type=bl_type, value=value, shop=_user["shop"])
    return {"status": "ok"}
