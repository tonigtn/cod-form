"""Admin API: billing plan management."""

from __future__ import annotations

from typing import Any

import structlog
from fastapi import APIRouter

from app.config import get_app_base_url
from app.session import SessionUser
from app.shopify.billing import (
    PLANS,
    FREE_ORDER_LIMIT,
    cancel_subscription,
    create_subscription,
    get_usage,
)

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/admin/billing", tags=["admin-billing"])


@router.get("/plans")
async def list_plans(_user: SessionUser) -> dict[str, Any]:
    """Return available billing plans."""
    plans = []
    plans.append({
        "key": "free",
        "name": "Free",
        "price": 0,
        "order_limit": FREE_ORDER_LIMIT,
        "features": ["Basic COD form", "Basic configuration", "80 orders/month"],
    })
    for key, plan in PLANS.items():
        plans.append({
            "key": key,
            "name": plan["name"],
            "price": plan["price"],
            "order_limit": plan["order_limit"],
            "trial_days": plan["trial_days"],
            "features": plan["features"],
        })
    return {"plans": plans}


@router.get("/usage")
async def billing_usage(_user: SessionUser) -> dict[str, Any]:
    """Get current plan usage for the session's shop."""
    return await get_usage(_user["shop"])


@router.post("/subscribe/{plan_key}")
async def subscribe(plan_key: str, _user: SessionUser) -> dict[str, Any]:
    """Create a subscription. Returns confirmation URL for merchant."""
    shop = _user["shop"]
    return_url = f"{get_app_base_url()}/admin/billing?shop={shop}"

    # Use test mode for non-production (can be toggled via env var)
    import os
    test = os.environ.get("BILLING_TEST_MODE", "true").lower() == "true"

    url = await create_subscription(shop, plan_key, return_url, test=test)
    if not url:
        return {"success": False, "error": "Failed to create subscription"}

    log.info("billing_subscribe_initiated", shop=shop, plan=plan_key)
    return {"success": True, "confirmation_url": url}


@router.post("/cancel")
async def cancel(_user: SessionUser) -> dict[str, Any]:
    """Cancel the active subscription."""
    shop = _user["shop"]
    ok = await cancel_subscription(shop)
    if not ok:
        return {"success": False, "error": "No active subscription to cancel"}
    return {"success": True}
