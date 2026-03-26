"""Admin API: store config CRUD — DB-backed."""

from __future__ import annotations

from typing import Any

import structlog
from fastapi import APIRouter, HTTPException

from app.services.store_config import VALID_SECTIONS, load_config_dict, update_config_section
from app.session import SessionUser
from app.shopify.tokens import get_shop_id_or_raise

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/admin/config", tags=["admin-config"])


async def _resolve_shop_id(user: SessionUser) -> int:
    """Resolve shop_id from session JWT shop domain."""
    try:
        return await get_shop_id_or_raise(user["shop"])
    except ValueError as exc:
        raise HTTPException(status_code=403, detail="Shop not configured") from exc


@router.get("/current")
async def get_current_config(_user: SessionUser) -> dict[str, Any]:
    """Return config for the session's shop."""
    shop_id = await _resolve_shop_id(_user)
    config = await load_config_dict(shop_id)
    log.info("cod_admin_config_read", shop=_user["shop"])
    return config


@router.put("/current/{section}")
async def update_current_config_section(
    section: str,
    body: dict[str, Any],
    _user: SessionUser,
) -> dict[str, str]:
    """Update config section for the session's shop."""
    shop_id = await _resolve_shop_id(_user)
    if section not in VALID_SECTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid section: {section}")
    await update_config_section(shop_id, section, body)
    log.info("cod_admin_config_updated", shop=_user["shop"], section=section)
    return {"status": "ok"}


@router.get("/locale")
async def get_store_locale(_user: SessionUser) -> dict[str, object]:
    """Return the store's locale labels for preview rendering."""
    from app.services.locale import get_shop_locale

    locale = await get_shop_locale(_user["shop"])
    return {"locale": locale}
