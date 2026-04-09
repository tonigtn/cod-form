"""Shopify draft-order creation for COD orders — no monorepo dependencies."""

from __future__ import annotations

from collections import Counter

import httpx
import structlog

from app.schemas import CodOrderRequest, CodOrderResponse
from app.services.bumps import validate_bump_variants
from app.services.offers import get_active_offer
from app.services.store_config import load_store_config
from app.shopify.tokens import get_token_or_raise

log = structlog.get_logger(__name__)

_API_VERSION = "2025-01"
_TIMEOUT = 30.0

_DRAFT_ORDER_CREATE = """
mutation draftOrderCreate($input: DraftOrderInput!) {
  draftOrderCreate(input: $input) {
    draftOrder {
      id
      name
    }
    userErrors {
      field
      message
    }
  }
}
"""

_DRAFT_ORDER_COMPLETE = """
mutation draftOrderComplete($id: ID!, $paymentPending: Boolean) {
  draftOrderComplete(id: $id, paymentPending: $paymentPending) {
    draftOrder {
      id
      name
      order {
        id
        name
      }
    }
    userErrors {
      field
      message
    }
  }
}
"""


async def create_cod_order(req: CodOrderRequest, shop_id: int) -> CodOrderResponse:
    """Create a COD order via Shopify draft order flow."""
    try:
        token = await get_token_or_raise(req.shop)
    except Exception as exc:
        log.error("cod_auth_failed", shop=req.shop, error=str(exc))
        return CodOrderResponse(success=False, error="Store configuration error")

    graphql_url = f"https://{req.shop}/admin/api/{_API_VERSION}/graphql.json"
    headers = {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
    }

    config = await load_store_config(shop_id)

    # Normalize phone to E.164 based on shop country
    phone = req.phone.replace(" ", "").replace("-", "")
    from app.shopify.tokens import get_shop_info

    shop_info = await get_shop_info(req.shop)
    country = shop_info.get("country_code", "RO") if shop_info else "RO"
    if country == "GR":
        if phone.startswith("69") or phone.startswith("2"):
            phone = "+30" + phone
    elif country == "PL":
        if not phone.startswith("+"):
            phone = "+48" + phone
    elif phone.startswith("0"):
        phone = "+4" + phone

    # Check for quantity discount — use req.quantity (offer quantity for current product),
    # not len(variant_ids) which may include other cart products
    offer = await get_active_offer(shop_id, req.quantity, product_id=req.product_id or None)
    discount_title = ""
    if offer:
        discount_title = f"Ofertă cantitate ({offer.label})"
        log.info(
            "cod_quantity_discount_applied",
            shop=req.shop,
            quantity=total_qty,
            discount_pct=offer.discount_percent,
        )

    # Check auto-discounts for this product
    auto_discount_amount = 0.0
    if config.auto_discounts.enabled:
        for ad in config.auto_discounts.discounts:
            if ad.product_id == req.product_id:
                auto_discount_amount = ad.discount_amount
                break

    # Build line items
    all_line_items: list[dict[str, object]] = []
    if req.variant_ids:
        # The first req.quantity entries are the offer product's variants;
        # the rest are other cart products that should not get the discount.
        offer_vids = set(req.variant_ids[: req.quantity]) if offer else set()
        variant_counts = Counter(req.variant_ids)
        for vid, count in variant_counts.items():
            li: dict[str, object] = {
                "variantId": f"gid://shopify/ProductVariant/{vid}",
                "quantity": count,
            }
            if offer and vid in offer_vids:
                li["appliedDiscount"] = {
                    "title": discount_title,
                    "value": float(offer.discount_percent),
                    "valueType": "PERCENTAGE",
                }
            elif auto_discount_amount > 0 and vid in offer_vids:
                li["appliedDiscount"] = {
                    "title": "Reducere automată",
                    "value": auto_discount_amount,
                    "valueType": "FIXED_AMOUNT",
                }
            all_line_items.append(li)
    else:
        line_item: dict[str, object] = {
            "variantId": f"gid://shopify/ProductVariant/{req.variant_id}",
            "quantity": req.quantity,
        }
        if offer:
            line_item["appliedDiscount"] = {
                "title": discount_title,
                "value": float(offer.discount_percent),
                "valueType": "PERCENTAGE",
            }
        elif auto_discount_amount > 0:
            line_item["appliedDiscount"] = {
                "title": "Reducere automată",
                "value": auto_discount_amount,
                "valueType": "FIXED_AMOUNT",
            }
        all_line_items.append(line_item)

    # Add bump items
    if req.bump_variant_ids:
        valid_bumps = await validate_bump_variants(shop_id, req.bump_variant_ids)
        for bump in valid_bumps:
            all_line_items.append(
                {
                    "variantId": f"gid://shopify/ProductVariant/{bump.variant_id}",
                    "quantity": bump.quantity,
                }
            )

    # Add upsell items
    if req.upsell_variant_ids:
        for i, upsell_vid in enumerate(req.upsell_variant_ids):
            upsell_li: dict[str, object] = {
                "variantId": f"gid://shopify/ProductVariant/{upsell_vid}",
                "quantity": 1,
            }
            if i < len(req.upsell_discounts) and req.upsell_discounts[i]:
                discount_amount = float(req.upsell_discounts[i])
                if discount_amount > 0:
                    upsell_li["appliedDiscount"] = {
                        "title": "Reducere upsell",
                        "value": discount_amount,
                        "valueType": "FIXED_AMOUNT",
                    }
            all_line_items.append(upsell_li)

    # Build FirstTrack tracking note (ft:{JSON} format)
    note = req.note or config.form.custom_note_prefix
    if req.custom_fields:
        _ft_map = {
            "_ft_vid": "v", "_ft_fbc": "fc", "_ft_fbp": "fp", "_ft_ttc": "tt",
            "_ft_gclid": "gc", "_ft_gbraid": "gb", "_ft_wbraid": "wb",
            "_ft_epik": "ep", "_ft_sccid": "sc", "_ft_twclid": "tw",
            "_ft_fp": "fg", "_ft_ua": "ua", "_ft_url": "u",
        }
        ft_data: dict[str, str] = {}
        for form_key, json_key in _ft_map.items():
            val = req.custom_fields.get(form_key, "")
            if val:
                ft_data[json_key] = val
        # Add customer IP to tracking blob
        ip_val = req.custom_fields.get("_trk_ip", "")
        if ip_val:
            ft_data["ip"] = ip_val
        if ft_data:
            import json as _json

            ft_json = _json.dumps(ft_data, separators=(",", ":"))
            note = f"{note}\nft:{ft_json}" if note else f"ft:{ft_json}"

    draft_input: dict[str, object] = {
        "lineItems": all_line_items,
        "shippingAddress": {
            "firstName": req.first_name,
            "lastName": req.last_name,
            "phone": phone,
            "address1": req.address1,
            "city": req.city,
            "province": req.province,
            "country": {"GR": "Greece", "PL": "Poland"}.get(country, "Romania"),
            "countryCode": country,
            "zip": req.zip or "",
        },
        "shippingLine": {
            "title": {"GR": "Courier", "PL": "Kurier"}.get(country, "Curier"),
            "price": req.shipping_price,
        },
        "note": note,
        "tags": list(config.form.tags),
        "phone": phone,
    }
    if req.email:
        draft_input["email"] = req.email
    if req.custom_fields:
        draft_input["customAttributes"] = [
            {"key": k, "value": v} for k, v in req.custom_fields.items()
        ]

    result = await _execute_draft_order(req, graphql_url, headers, draft_input)

    # Retry once on 401
    if result.error and "401" in result.error:
        log.warning("cod_token_expired_retrying", shop=req.shop)
        from app.shopify.tokens import invalidate_token

        invalidate_token(req.shop)
        new_token = await get_token_or_raise(req.shop)
        headers["X-Shopify-Access-Token"] = new_token
        result = await _execute_draft_order(req, graphql_url, headers, draft_input)

    if not result.success:
        log.error(
            "cod_order_failed_full_payload",
            shop=req.shop,
            first_name=req.first_name,
            last_name=req.last_name,
            phone=req.phone,
            address1=req.address1,
            city=req.city,
            province=req.province,
            variant_id=req.variant_id,
            error=result.error,
        )

    return result


async def _execute_draft_order(
    req: CodOrderRequest,
    graphql_url: str,
    headers: dict[str, str],
    draft_input: dict[str, object],
) -> CodOrderResponse:
    """Execute the two-step draft order flow."""
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
            error_msg = "; ".join(e.get("message", "") for e in data["errors"])
            log.error("cod_graphql_errors", shop=req.shop, errors=error_msg)
            return CodOrderResponse(success=False, error="Shopify API error")

        create_data = data.get("data", {}).get("draftOrderCreate") or {}
        user_errors = create_data.get("userErrors", [])
        if user_errors:
            error_msg = "; ".join(e.get("message", "") for e in user_errors)
            return CodOrderResponse(success=False, error=error_msg)

        draft_order = create_data.get("draftOrder", {})
        draft_gid = draft_order.get("id", "")
        if not draft_gid:
            return CodOrderResponse(success=False, error="Failed to create draft order")

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

        complete_result = complete_data.get("data", {}).get("draftOrderComplete", {})
        complete_errors = complete_result.get("userErrors", [])
        if complete_errors:
            error_msg = "; ".join(e.get("message", "") for e in complete_errors)
            return CodOrderResponse(success=False, error=error_msg)

        completed_draft = complete_result.get("draftOrder", {})
        order = completed_draft.get("order", {})
        order_name = order.get("name", completed_draft.get("name", ""))
        order_gid = order.get("id", "")
        order_id = int(order_gid.split("/")[-1]) if order_gid else 0

        log.info("cod_order_created", shop=req.shop, order_name=order_name, order_id=order_id)
        return CodOrderResponse(success=True, order_name=order_name, order_id=order_id)

    except httpx.HTTPStatusError as exc:
        error_detail = f"{exc.response.status_code} {exc!s}"
        log.error("cod_shopify_http_error", shop=req.shop, error=error_detail)
        return CodOrderResponse(success=False, error=error_detail)
    except httpx.HTTPError as exc:
        log.error("cod_shopify_http_error", shop=req.shop, error=str(exc))
        return CodOrderResponse(success=False, error="Shopify API error")
    except Exception as exc:
        log.error("cod_order_unexpected_error", shop=req.shop, error=str(exc))
        return CodOrderResponse(success=False, error="Unexpected error")
