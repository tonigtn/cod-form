"""Post-purchase upsell service — fetch products and add to existing orders."""

from __future__ import annotations

import httpx
import structlog

from app.schemas import UpsellAddRequest, UpsellAddResponse, UpsellsResponse
from app.services.store_config import load_store_config
from app.shopify.products import fetch_products_by_ids
from app.shopify.tokens import get_token_or_raise

log = structlog.get_logger(__name__)

_API_VERSION = "2025-01"
_TIMEOUT = 30.0

_DRAFT_ORDER_CREATE = """
mutation draftOrderCreate($input: DraftOrderInput!) {
  draftOrderCreate(input: $input) {
    draftOrder { id name }
    userErrors { field message }
  }
}
"""

_DRAFT_ORDER_COMPLETE = """
mutation draftOrderComplete($id: ID!, $paymentPending: Boolean) {
  draftOrderComplete(id: $id, paymentPending: $paymentPending) {
    draftOrder { id name order { id name } }
    userErrors { field message }
  }
}
"""

_ORDER_SHIPPING_QUERY = """
query orderShipping($id: ID!) {
  order(id: $id) {
    name
    email
    phone
    shippingAddress {
      firstName lastName address1 address2 city province country countryCode zip phone
    }
  }
}
"""


async def get_upsell_products(shop: str, shop_id: int, product_id: int) -> UpsellsResponse:
    """Get upsell product recommendations for a purchased product."""
    config = await load_store_config(shop_id)
    if not config.upsells.enabled:
        return UpsellsResponse()

    product_key = str(product_id)
    upsell_ids = config.upsells.product_mappings.get(
        product_key, list(config.upsells.default_product_ids)
    )
    if not upsell_ids:
        return UpsellsResponse()

    # Determine currency from shop info
    from app.shopify.tokens import get_shop_info

    info = await get_shop_info(shop)
    currency = info.get("currency", "RON") if info else "RON"

    try:
        products = await fetch_products_by_ids(shop, upsell_ids, currency)
    except Exception as exc:
        log.error("upsell_fetch_failed", shop=shop, error=str(exc))
        return UpsellsResponse()

    return UpsellsResponse(products=products)


async def add_upsell_to_order(req: UpsellAddRequest) -> UpsellAddResponse:
    """Add an upsell item by creating a linked draft order."""
    try:
        token = await get_token_or_raise(req.shop)
    except Exception as exc:
        log.error("upsell_auth_failed", shop=req.shop, error=str(exc))
        return UpsellAddResponse(success=False, error="Store configuration error")

    graphql_url = f"https://{req.shop}/admin/api/{_API_VERSION}/graphql.json"
    headers = {"X-Shopify-Access-Token": token, "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            # Step 1: Fetch original order's shipping address
            order_gid = f"gid://shopify/Order/{req.order_id}"
            resp = await client.post(
                graphql_url,
                headers=headers,
                json={"query": _ORDER_SHIPPING_QUERY, "variables": {"id": order_gid}},
            )
            resp.raise_for_status()
            order_data = resp.json()

        order = order_data.get("data", {}).get("order", {})
        order_name = order.get("name", "")
        shipping = order.get("shippingAddress") or {}

        note = f"Upsell — comanda originală {order_name}"
        line_item: dict[str, object] = {
            "variantId": f"gid://shopify/ProductVariant/{req.variant_id}",
            "quantity": req.quantity,
        }

        # Apply discount if compare_at > sale price
        compare_at = float(req.compare_at_price) if req.compare_at_price else 0.0
        sale_price = float(req.price) if req.price else 0.0
        if compare_at > 0 and sale_price > 0 and compare_at > sale_price:
            savings = round(compare_at - sale_price, 2)
            line_item["originalUnitPrice"] = str(compare_at)
            line_item["appliedDiscount"] = {
                "valueType": "FIXED_AMOUNT",
                "value": savings,
                "title": "Reducere upsell",
            }

        draft_input: dict[str, object] = {
            "lineItems": [line_item],
            "note": note,
            "tags": ["upsell", f"upsell-from-{order_name}"],
        }

        if shipping:
            draft_input["shippingAddress"] = {
                "firstName": shipping.get("firstName", ""),
                "lastName": shipping.get("lastName", ""),
                "address1": shipping.get("address1", ""),
                "city": shipping.get("city", ""),
                "province": shipping.get("province", ""),
                "country": shipping.get("country", ""),
                "countryCode": shipping.get("countryCode", ""),
                "zip": shipping.get("zip", ""),
                "phone": shipping.get("phone", ""),
            }

        if order.get("email"):
            draft_input["email"] = order["email"]
        if order.get("phone"):
            draft_input["phone"] = order["phone"]

        # Step 2: Create + complete draft order
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                graphql_url,
                headers=headers,
                json={"query": _DRAFT_ORDER_CREATE, "variables": {"input": draft_input}},
            )
            resp.raise_for_status()
            create_data = resp.json()

        if err := _check_errors(create_data, "draftOrderCreate"):
            return UpsellAddResponse(success=False, error=err)

        draft = create_data.get("data", {}).get("draftOrderCreate", {}).get("draftOrder", {})
        draft_gid = draft.get("id", "")
        if not draft_gid:
            return UpsellAddResponse(success=False, error="Failed to create upsell order")

        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                graphql_url,
                headers=headers,
                json={
                    "query": _DRAFT_ORDER_COMPLETE,
                    "variables": {"id": draft_gid, "paymentPending": True},
                },
            )
            resp.raise_for_status()
            complete_data = resp.json()

        if err := _check_errors(complete_data, "draftOrderComplete"):
            return UpsellAddResponse(success=False, error=err)

    except httpx.HTTPError as exc:
        log.error("upsell_http_error", shop=req.shop, error=str(exc))
        return UpsellAddResponse(success=False, error="Shopify API error")
    except Exception as exc:
        log.error("upsell_unexpected_error", shop=req.shop, error=str(exc))
        return UpsellAddResponse(success=False, error="Unexpected error")

    log.info("upsell_added", shop=req.shop, order_id=req.order_id, variant_id=req.variant_id)
    return UpsellAddResponse(success=True)


def _check_errors(data: dict[str, object], mutation_name: str) -> str:
    """Check GraphQL response for errors."""
    if data.get("errors"):
        errors = data["errors"]
        if isinstance(errors, list):
            return "; ".join(str(e.get("message", "")) for e in errors if isinstance(e, dict))
        return str(errors)
    mutation_data = data.get("data", {})
    if isinstance(mutation_data, dict):
        result = mutation_data.get(mutation_name, {})
        if isinstance(result, dict):
            user_errors = result.get("userErrors", [])
            if user_errors and isinstance(user_errors, list):
                return "; ".join(e.get("message", "") for e in user_errors)
    return ""
