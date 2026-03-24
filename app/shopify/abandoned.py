"""Shopify abandoned checkout draft order management."""

from __future__ import annotations

from typing import Any

import httpx
import structlog

from app.shopify.tokens import get_token_or_raise

log = structlog.get_logger(__name__)

_API_VERSION = "2025-01"
_TIMEOUT = 15.0

_DRAFT_ORDER_CREATE = """
mutation draftOrderCreate($input: DraftOrderInput!) {
  draftOrderCreate(input: $input) {
    draftOrder { id name }
    userErrors { field message }
  }
}
"""

_DRAFT_ORDER_DELETE = """
mutation draftOrderDelete($input: DraftOrderDeleteInput!) {
  draftOrderDelete(input: $input) {
    deletedId
    userErrors { field message }
  }
}
"""


async def create_abandoned_checkout(
    shop: str,
    phone: str,
    first_name: str,
    variant_id: int,
    unit_price: float,
    province: str = "",
) -> str | None:
    """Create an incomplete Shopify draft order for an abandoned form.

    Returns the draft order GID if created, or None on failure.
    """
    if not variant_id:
        return None

    try:
        token = await get_token_or_raise(shop)
    except Exception as exc:
        log.warning("abandoned_checkout_auth_failed", shop=shop, error=str(exc))
        return None

    normalized_phone = phone.replace(" ", "").replace("-", "")
    if normalized_phone.startswith("0"):
        normalized_phone = "+4" + normalized_phone

    draft_input: dict[str, Any] = {
        "lineItems": [{"variantId": f"gid://shopify/ProductVariant/{variant_id}", "quantity": 1}],
        "shippingAddress": {
            "firstName": first_name or "Abandonat",
            "lastName": "",
            "phone": normalized_phone,
            "address1": "",
            "city": "",
            "province": province,
            "country": "Romania",
            "countryCode": "RO",
        },
        "note": "Formular abandonat — client a completat parțial formularul COD",
        "tags": ["abandoned-cod-form"],
        "phone": normalized_phone,
    }

    graphql_url = f"https://{shop}/admin/api/{_API_VERSION}/graphql.json"
    headers = {"X-Shopify-Access-Token": token, "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                graphql_url,
                headers=headers,
                json={"query": _DRAFT_ORDER_CREATE, "variables": {"input": draft_input}},
            )
            resp.raise_for_status()
            data = resp.json()

        if data.get("errors"):
            return None

        create_data = data.get("data", {}).get("draftOrderCreate") or {}
        if create_data.get("userErrors"):
            return None

        draft_order = create_data.get("draftOrder", {})
        draft_gid = draft_order.get("id", "")
        log.info("abandoned_checkout_created", shop=shop, draft_gid=draft_gid)
        return draft_gid or None

    except Exception as exc:
        log.warning("abandoned_checkout_failed", shop=shop, error=str(exc))
        return None


async def delete_abandoned_checkout(shop: str, draft_gid: str) -> bool:
    """Delete an abandoned checkout draft."""
    if not draft_gid:
        return False

    try:
        token = await get_token_or_raise(shop)
    except Exception:
        return False

    graphql_url = f"https://{shop}/admin/api/{_API_VERSION}/graphql.json"
    headers = {"X-Shopify-Access-Token": token, "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                graphql_url,
                headers=headers,
                json={"query": _DRAFT_ORDER_DELETE, "variables": {"input": {"id": draft_gid}}},
            )
            resp.raise_for_status()
            data = resp.json()

        result = data.get("data", {}).get("draftOrderDelete", {})
        if result.get("deletedId"):
            log.info("abandoned_checkout_deleted", shop=shop, draft_gid=draft_gid)
            return True
        return False

    except Exception as exc:
        log.warning("abandoned_checkout_delete_failed", shop=shop, error=str(exc))
        return False
