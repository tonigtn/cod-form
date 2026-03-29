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


@router.get("/theme-embed-status")
async def theme_embed_status(_user: SessionUser) -> dict[str, Any]:
    """Check if our theme app embed is enabled on the shop's live theme."""
    import httpx

    from app.shopify.tokens import get_token_or_raise

    shop = _user["shop"]
    token = await get_token_or_raise(shop)
    headers = {"X-Shopify-Access-Token": token}

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Get the main (live) theme
        resp = await client.get(
            f"https://{shop}/admin/api/2025-01/themes.json",
            headers=headers,
        )
        resp.raise_for_status()
        themes = resp.json().get("themes", [])
        main_theme = next((t for t in themes if t.get("role") == "main"), None)
        if not main_theme:
            return {"enabled": False, "theme_id": 0}

        theme_id = main_theme["id"]

        # Read settings_data.json to check app embed status
        resp = await client.get(
            f"https://{shop}/admin/api/2025-01/themes/{theme_id}/assets.json",
            headers=headers,
            params={"asset[key]": "config/settings_data.json"},
        )
        resp.raise_for_status()
        asset_value = resp.json().get("asset", {}).get("value", "")

    if not asset_value:
        return {"enabled": False, "theme_id": theme_id}

    import orjson

    settings: dict[str, Any] = orjson.loads(asset_value)
    current = settings.get("current", {})
    blocks: dict[str, Any] = current.get("blocks", {})

    # Look for our extension blocks: "cod-form-embed" (per-template) or "app-embed" (global)
    # Block types: shopify://apps/<app-handle>/blocks/<block-handle>/<uuid>
    enabled = False
    for block in blocks.values():
        block_type = block.get("type", "")
        if (
            "/blocks/app-embed/" in block_type or "/blocks/cod-form-embed/" in block_type
        ) and not block.get("disabled", False):
            enabled = True
            break

    return {"enabled": enabled, "theme_id": theme_id}
