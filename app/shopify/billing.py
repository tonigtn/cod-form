"""Shopify Billing API — create and manage app subscriptions.

Adapted from FirstTrack billing module for COD Form APP.
Plans: Free (80 orders/mo), Pro $7.99 (500 orders/mo), Premium $19.99 (unlimited).
"""

from __future__ import annotations

from typing import Any

import httpx
import structlog

from app.db import pool
from app.shopify.tokens import get_token_or_raise

log = structlog.get_logger(__name__)

_API_VERSION = "2025-01"

# ── Plan definitions ────────────────────────────────────────────────

PLANS: dict[str, dict[str, Any]] = {
    "pro": {
        "name": "Pro",
        "price": 7.99,
        "order_limit": 500,
        "trial_days": 14,
        "features": ["upsells", "bumps", "multi_product_cart", "quantity_offers", "discount_codes", "analytics"],
    },
    "premium": {
        "name": "Premium",
        "price": 19.99,
        "order_limit": 999_999_999,
        "trial_days": 14,
        "features": ["upsells", "bumps", "multi_product_cart", "quantity_offers", "discount_codes", "analytics", "auto_discounts", "downsell", "otp", "priority_support"],
    },
}

FREE_ORDER_LIMIT = 80
FREE_FEATURES: list[str] = ["basic_form", "basic_config"]


def get_plan_limit(plan_key: str) -> int:
    """Get order limit for a plan."""
    if plan_key in PLANS:
        return int(PLANS[plan_key]["order_limit"])
    return FREE_ORDER_LIMIT


def get_plan_features(plan_key: str) -> list[str]:
    """Get feature list for a plan."""
    if plan_key in PLANS:
        return list(PLANS[plan_key]["features"])
    return list(FREE_FEATURES)


# ── GraphQL mutations ──────────────────────────────────────────────

_SUBSCRIPTION_CREATE = """
mutation appSubscriptionCreate(
  $name: String!
  $returnUrl: URL!
  $trialDays: Int
  $lineItems: [AppSubscriptionLineItemInput!]!
  $test: Boolean
) {
  appSubscriptionCreate(
    name: $name
    returnUrl: $returnUrl
    trialDays: $trialDays
    lineItems: $lineItems
    test: $test
  ) {
    appSubscription {
      id
      status
    }
    confirmationUrl
    userErrors {
      field
      message
    }
  }
}
"""

_SUBSCRIPTION_QUERY = """
query {
  currentAppInstallation {
    activeSubscriptions {
      id
      name
      status
      currentPeriodEnd
      trialDays
      lineItems {
        plan {
          pricingDetails {
            ... on AppRecurringPricing {
              price { amount currencyCode }
              interval
            }
          }
        }
      }
    }
  }
}
"""

_SUBSCRIPTION_CANCEL = """
mutation appSubscriptionCancel($id: ID!) {
  appSubscriptionCancel(id: $id) {
    appSubscription {
      id
      status
    }
    userErrors {
      field
      message
    }
  }
}
"""


async def _graphql(shop: str, query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
    """Execute a Shopify GraphQL request."""
    token = await get_token_or_raise(shop)
    url = f"https://{shop}/admin/api/{_API_VERSION}/graphql.json"
    payload: dict[str, Any] = {"query": query}
    if variables:
        payload["variables"] = variables

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            url,
            json=payload,
            headers={"X-Shopify-Access-Token": token, "Content-Type": "application/json"},
        )
        resp.raise_for_status()
        result: dict[str, Any] = resp.json()
        return result


async def create_subscription(
    shop: str,
    plan_key: str,
    return_url: str,
    *,
    test: bool = False,
) -> str | None:
    """Create an app subscription. Returns confirmation URL for merchant approval."""
    plan = PLANS.get(plan_key)
    if not plan:
        log.warning("billing_invalid_plan", shop=shop, plan=plan_key)
        return None

    result = await _graphql(
        shop,
        _SUBSCRIPTION_CREATE,
        {
            "name": f"COD Form APP {plan['name']}",
            "returnUrl": return_url,
            "trialDays": plan["trial_days"],
            "test": test,
            "lineItems": [
                {
                    "plan": {
                        "appRecurringPricingDetails": {
                            "price": {"amount": plan["price"], "currencyCode": "USD"},
                            "interval": "EVERY_30_DAYS",
                        },
                    },
                },
            ],
        },
    )

    data = (result.get("data") or {}).get("appSubscriptionCreate") or {}
    errors = data.get("userErrors") or []
    if errors:
        log.warning("billing_create_failed", shop=shop, plan=plan_key, errors=errors)
        return None

    confirmation_url: str = data.get("confirmationUrl") or ""
    sub = data.get("appSubscription") or {}
    sub_id = sub.get("id", "")

    if sub_id:
        await pool.execute(
            "UPDATE shops SET plan = $1, app_subscription_id = $2 WHERE shop_domain = $3",
            plan_key, sub_id, shop,
        )
        log.info("billing_subscription_created", shop=shop, plan=plan_key, sub_id=sub_id)

    return confirmation_url or None


async def get_active_subscription(shop: str) -> dict[str, Any] | None:
    """Query the shop's active app subscription."""
    result = await _graphql(shop, _SUBSCRIPTION_QUERY)
    data = (result.get("data") or {}).get("currentAppInstallation") or {}
    subs = data.get("activeSubscriptions") or []
    return dict(subs[0]) if subs else None


async def cancel_subscription(shop: str) -> bool:
    """Cancel the shop's active subscription."""
    sub_id = await pool.fetchval(
        "SELECT app_subscription_id FROM shops WHERE shop_domain = $1", shop
    )
    if not sub_id:
        return False

    result = await _graphql(shop, _SUBSCRIPTION_CANCEL, {"id": sub_id})
    data = (result.get("data") or {}).get("appSubscriptionCancel") or {}
    errors = data.get("userErrors") or []
    if errors:
        log.warning("billing_cancel_failed", shop=shop, errors=errors)
        return False

    await pool.execute(
        "UPDATE shops SET plan = 'free', app_subscription_id = NULL WHERE shop_domain = $1",
        shop,
    )
    log.info("billing_subscription_cancelled", shop=shop)
    return True


async def get_usage(shop: str) -> dict[str, Any]:
    """Get current billing cycle usage for a shop."""
    row = await pool.fetchrow(
        "SELECT id, plan, app_subscription_id FROM shops WHERE shop_domain = $1", shop
    )
    plan_key = row["plan"] if row and row["plan"] else "free"
    plan = PLANS.get(plan_key)
    order_limit = plan["order_limit"] if plan else FREE_ORDER_LIMIT
    shop_id = row["id"] if row else 0

    orders_used = await pool.fetchval(
        "SELECT COUNT(*) FROM orders WHERE shop_id = $1 AND created_at >= NOW() - INTERVAL '30 days'",
        shop_id,
    ) if shop_id else 0

    return {
        "plan": plan_key,
        "plan_name": plan["name"] if plan else "Free",
        "orders_used": int(orders_used or 0),
        "order_limit": int(order_limit),
        "has_subscription": bool(row and row["app_subscription_id"]),
        "features": get_plan_features(plan_key),
    }


async def check_order_limit(shop: str) -> tuple[bool, str]:
    """Check if the shop can create more orders. Returns (allowed, message)."""
    usage = await get_usage(shop)
    if usage["orders_used"] >= usage["order_limit"]:
        return False, f"Monthly order limit reached ({usage['order_limit']}). Upgrade your plan."
    return True, ""
