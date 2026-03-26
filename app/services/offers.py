"""Quantity offer tiers for COD orders — increases AOV."""

from __future__ import annotations

from app.schemas import QuantityOffer
from app.services.store_config import load_store_config


async def get_offers(shop_id: int, product_id: int | None = None) -> list[QuantityOffer]:
    """Return quantity offers for a shop, optionally filtered by product."""
    config = await load_store_config(shop_id)
    result: list[QuantityOffer] = []

    # Check if a product-specific group exists — if so, skip default (empty product_ids)
    has_specific = False
    if product_id:
        has_specific = any(
            g.enabled and g.product_ids and product_id in g.product_ids
            for g in config.offer_groups
        )

    for group in config.offer_groups:
        if not group.enabled:
            continue
        if product_id and group.product_ids and product_id not in group.product_ids:
            continue
        # Skip default group if product has its own specific group
        if has_specific and not group.product_ids:
            continue
        for tier in group.tiers:
            result.append(
                QuantityOffer(
                    min_qty=tier.min_qty,
                    title=tier.title,
                    discount_type=tier.discount_type,
                    discount_percent=tier.discount_percent,
                    discount_fixed=tier.discount_fixed,
                    tag=tier.tag,
                    tag_bg=tier.tag_bg,
                    label=tier.label,
                    image_url=tier.image_url,
                    preselect=tier.preselect,
                )
            )

    return result


async def get_active_offer(
    shop_id: int, quantity: int, product_id: int | None = None
) -> QuantityOffer | None:
    """Return the best matching offer for the given quantity."""
    offers = await get_offers(shop_id, product_id=product_id)
    active: QuantityOffer | None = None
    for offer in offers:
        if quantity >= offer.min_qty and (active is None or offer.min_qty > active.min_qty):
            active = offer
    return active
