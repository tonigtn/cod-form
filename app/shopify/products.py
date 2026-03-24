"""Shopify product queries for admin product picker and upsells."""

from __future__ import annotations

from typing import Any

import httpx
import structlog

from app.schemas import UpsellProduct, UpsellVariant
from app.shopify.tokens import get_token_or_raise

log = structlog.get_logger(__name__)

_API_VERSION = "2025-01"
_TIMEOUT = 15.0

_PRODUCTS_QUERY = """
query products($query: String, $first: Int!) {
  products(first: $first, query: $query, sortKey: TITLE) {
    edges {
      node {
        id
        title
        status
        featuredImage { url }
        variants(first: 1) {
          edges {
            node {
              price
            }
          }
        }
      }
    }
  }
}
"""

_PRODUCTS_BY_IDS = """
query productsByIds($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on Product {
      id
      title
      featuredImage { url }
      variants(first: 20) {
        edges {
          node {
            id
            title
            price
            compareAtPrice
            image { url }
          }
        }
      }
    }
  }
}
"""


def _gid_to_id(gid: str) -> int:
    """Extract numeric ID from Shopify GID."""
    return int(gid.rsplit("/", 1)[-1])


async def search_products(shop: str, search: str = "") -> list[dict[str, Any]]:
    """Search active products for the admin product picker."""
    token = await get_token_or_raise(shop)
    url = f"https://{shop}/admin/api/{_API_VERSION}/graphql.json"

    query_filter = "status:active"
    if search.strip():
        query_filter = f"title:*{search.strip()}* AND status:active"

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            url,
            json={"query": _PRODUCTS_QUERY, "variables": {"query": query_filter, "first": 50}},
            headers={"X-Shopify-Access-Token": token, "Content-Type": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()

    edges = data.get("data", {}).get("products", {}).get("edges", [])
    products: list[dict[str, Any]] = []
    for edge in edges:
        node = edge["node"]
        variant_edges = node.get("variants", {}).get("edges", [])
        price = variant_edges[0]["node"]["price"] if variant_edges else "0.00"
        image_url = ""
        if node.get("featuredImage"):
            image_url = node["featuredImage"]["url"]

        products.append(
            {
                "id": _gid_to_id(node["id"]),
                "title": node["title"],
                "image_url": image_url,
                "price": price,
            }
        )

    return products


async def fetch_products_by_ids(
    shop: str, product_ids: list[int], currency: str = "RON"
) -> list[UpsellProduct]:
    """Fetch product details from Shopify for upsell display."""
    token = await get_token_or_raise(shop)
    graphql_url = f"https://{shop}/admin/api/{_API_VERSION}/graphql.json"
    headers = {"X-Shopify-Access-Token": token, "Content-Type": "application/json"}

    gids = [f"gid://shopify/Product/{pid}" for pid in product_ids]

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            graphql_url,
            headers=headers,
            json={"query": _PRODUCTS_BY_IDS, "variables": {"ids": gids}},
        )
        resp.raise_for_status()
        data = resp.json()

    nodes = data.get("data", {}).get("nodes") or []
    products: list[UpsellProduct] = []
    for node in nodes:
        if not node or not node.get("id"):
            continue
        variant_edges = node.get("variants", {}).get("edges", [])
        if not variant_edges:
            continue
        first_variant = variant_edges[0]["node"]
        featured_image = node.get("featuredImage") or {}

        variant_list: list[UpsellVariant] = []
        if len(variant_edges) > 1:
            for edge in variant_edges:
                v = edge["node"]
                v_image = v.get("image") or {}
                variant_list.append(
                    UpsellVariant(
                        variant_id=_gid_to_id(v["id"]),
                        title=v.get("title", ""),
                        price=v.get("price", "0.00"),
                        compare_at_price=v.get("compareAtPrice") or "",
                        image_url=v_image.get("url", ""),
                    )
                )

        products.append(
            UpsellProduct(
                product_id=_gid_to_id(node["id"]),
                variant_id=_gid_to_id(first_variant["id"]),
                title=node.get("title", ""),
                image_url=featured_image.get("url", ""),
                price=first_variant.get("price", "0.00"),
                compare_at_price=first_variant.get("compareAtPrice") or "",
                currency=currency,
                variants=variant_list,
            )
        )

    return products
