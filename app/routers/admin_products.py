"""Admin API: product search via Shopify GraphQL."""

from __future__ import annotations

from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Query

from app.session import SessionUser
from app.shopify.products import search_products

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/admin/products", tags=["admin-products"])


@router.get("")
async def list_products(
    search: str = Query(default="", description="Search query"),
    _user: SessionUser = ...,  # type: ignore[assignment]
) -> dict[str, Any]:
    """Fetch products from Shopify for the product picker."""
    shop = _user["shop"]
    try:
        products = await search_products(shop, search)
    except Exception as exc:
        log.error("admin_products_fetch_error", shop=shop, error=str(exc))
        raise HTTPException(status_code=502, detail="Failed to fetch products") from exc

    log.info("admin_products_fetched", shop=shop, count=len(products), search=search)
    return {"products": products}
