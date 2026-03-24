"""Shopify discount code validation — DB-backed token lookup."""

from __future__ import annotations

import httpx
import structlog

from app.schemas import DiscountValidationRequest, DiscountValidationResponse
from app.shopify.tokens import get_token_or_raise

log = structlog.get_logger(__name__)

_API_VERSION = "2025-01"
_TIMEOUT = 15.0

_DISCOUNT_QUERY = """
query discountByCode($code: String!) {
  codeDiscountNodeByCode(code: $code) {
    id
    codeDiscount {
      ... on DiscountCodeBasic {
        title
        status
        startsAt
        endsAt
        customerGets {
          value {
            ... on DiscountPercentage {
              percentage
            }
            ... on DiscountAmount {
              amount {
                amount
              }
            }
          }
        }
      }
      ... on DiscountCodeFreeShipping {
        title
        status
      }
    }
  }
}
"""


async def validate_discount(req: DiscountValidationRequest) -> DiscountValidationResponse:
    """Validate a Shopify discount code via GraphQL."""
    try:
        token = await get_token_or_raise(req.shop)
    except Exception as exc:
        log.error("cod_discount_auth_failed", shop=req.shop, error=str(exc))
        return DiscountValidationResponse(valid=False, error="Store configuration error")

    graphql_url = f"https://{req.shop}/admin/api/{_API_VERSION}/graphql.json"
    headers = {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                graphql_url,
                headers=headers,
                json={"query": _DISCOUNT_QUERY, "variables": {"code": req.code}},
            )
            resp.raise_for_status()
            data = resp.json()

        node = data.get("data", {}).get("codeDiscountNodeByCode")
        if not node:
            return DiscountValidationResponse(valid=False, error="Cod invalid sau expirat")

        discount = node.get("codeDiscount", {})
        status = discount.get("status", "")
        if status != "ACTIVE":
            return DiscountValidationResponse(valid=False, error="Cod expirat sau inactiv")

        title = discount.get("title", req.code)

        customer_gets = discount.get("customerGets", {})
        value_obj = customer_gets.get("value", {})

        pct = value_obj.get("percentage")
        if pct is not None:
            return DiscountValidationResponse(
                valid=True,
                discount_type="percentage",
                value=round(float(pct) * 100, 1),
                title=title,
            )

        amount_obj = value_obj.get("amount")
        if amount_obj:
            amount = float(amount_obj.get("amount", 0))
            return DiscountValidationResponse(
                valid=True,
                discount_type="fixed_amount",
                value=amount,
                title=title,
            )

        if "DiscountCodeFreeShipping" in str(node):
            return DiscountValidationResponse(
                valid=True,
                discount_type="free_shipping",
                value=0,
                title=title,
            )

        return DiscountValidationResponse(valid=False, error="Tip de reducere necunoscut")

    except httpx.HTTPError as exc:
        log.error("cod_discount_http_error", shop=req.shop, error=str(exc))
        return DiscountValidationResponse(valid=False, error="Eroare la verificarea codului")
    except Exception as exc:
        log.error("cod_discount_unexpected_error", shop=req.shop, error=str(exc))
        return DiscountValidationResponse(valid=False, error="Eroare neașteptată")
