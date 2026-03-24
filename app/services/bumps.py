"""Order bump logic — get applicable bumps for a product."""

from __future__ import annotations

from app.schemas import OrderBumpItem, OrderBumpsResponse
from app.services.store_config import CodBumpItem, load_store_config


async def get_bumps(shop_id: int, product_id: int) -> OrderBumpsResponse:
    """Return order bumps available for a given product."""
    config = await load_store_config(shop_id)
    if not config.bumps.enabled:
        return OrderBumpsResponse()

    result: list[OrderBumpItem] = []
    for item in config.bumps.items:
        if not item.enabled:
            continue
        if item.target_product_ids and product_id not in item.target_product_ids:
            continue
        result.append(
            OrderBumpItem(
                variant_id=item.variant_id,
                title=item.title,
                price=item.price,
                image_url=item.image_url,
                text=item.text,
            )
        )
    return OrderBumpsResponse(bumps=result)


async def validate_bump_variants(shop_id: int, bump_variant_ids: list[int]) -> list[CodBumpItem]:
    """Validate bump variant IDs against config. Returns valid bump items."""
    config = await load_store_config(shop_id)
    if not config.bumps.enabled or not bump_variant_ids:
        return []

    valid_by_vid = {item.variant_id: item for item in config.bumps.items if item.enabled}
    return [valid_by_vid[vid] for vid in bump_variant_ids if vid in valid_by_vid]
