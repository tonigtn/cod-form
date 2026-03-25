"""Admin API: analytics — form opens, orders, revenue, conversion, UTM."""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Query

from app.db import pool
from app.services.events import load_events
from app.session import SessionUser
from app.shopify.tokens import get_shop_id_or_raise

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/admin/analytics", tags=["admin-analytics"])


@router.get("")
async def analytics(
    _user: SessionUser,
    days: int = Query(default=7, ge=1, le=90),
) -> dict[str, Any]:
    """Return analytics for the session's shop."""
    shop_id = await get_shop_id_or_raise(_user["shop"])
    cutoff = (datetime.now(tz=UTC) - timedelta(days=days)).isoformat()

    events = await load_events(shop_id, since_iso=cutoff)

    # Count recent orders from DB
    cutoff_dt = datetime.now(tz=UTC) - timedelta(days=days)
    order_count = (
        await pool.fetchval(
            "SELECT COUNT(*) FROM orders WHERE shop_id = $1 AND created_at > $2",
            shop_id,
            cutoff_dt,
        )
        or 0
    )

    # Core metrics from events
    form_opens = sum(1 for e in events if e.get("event") == "form_open")
    total_revenue = sum(
        float(e.get("order_value", 0)) for e in events if e.get("event") == "order_success"
    )
    conversion_rate = round((order_count / form_opens * 100) if form_opens > 0 else 0, 2)
    avg_order_value = round(total_revenue / order_count if order_count > 0 else 0, 2)

    # Daily breakdown
    daily_opens: dict[str, int] = defaultdict(int)
    daily_orders: dict[str, int] = defaultdict(int)
    daily_revenue: dict[str, float] = defaultdict(float)

    for e in events:
        day = e.get("ts", "")[:10]
        if e.get("event") == "form_open":
            daily_opens[day] += 1
        elif e.get("event") == "order_success":
            daily_orders[day] += 1
            daily_revenue[day] += float(e.get("order_value", 0))

    all_days = _date_range(days)
    daily = [
        {
            "date": d,
            "form_opens": daily_opens.get(d, 0),
            "orders": daily_orders.get(d, 0),
            "revenue": round(daily_revenue.get(d, 0), 2),
        }
        for d in all_days
    ]

    # UTM breakdown
    utm_map: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"form_opens": 0, "orders": 0, "campaign": "-", "source": "-", "medium": "-"}
    )
    for e in events:
        src = e.get("utm_source", "") or "-"
        med = e.get("utm_medium", "") or "-"
        camp = e.get("utm_campaign", "") or "-"
        key = f"{camp}|{src}|{med}"
        if e.get("event") == "form_open":
            utm_map[key]["form_opens"] += 1
        elif e.get("event") == "order_success":
            utm_map[key]["orders"] += 1
        utm_map[key]["campaign"] = camp
        utm_map[key]["source"] = src
        utm_map[key]["medium"] = med

    utm_data = []
    for v in sorted(utm_map.values(), key=lambda x: x.get("orders", 0), reverse=True):
        opens = v.get("form_opens", 0)
        orders_count = v.get("orders", 0)
        utm_data.append(
            {
                "campaign": v.get("campaign", "-"),
                "source": v.get("source", "-"),
                "medium": v.get("medium", "-"),
                "form_opens": opens,
                "orders": orders_count,
                "conversion_rate": round((orders_count / opens * 100) if opens > 0 else 0, 1),
            }
        )

    # Top products by order count
    product_rows = await pool.fetch(
        """SELECT variant_id, COUNT(*) as cnt FROM orders
           WHERE shop_id = $1 AND created_at > $2 AND variant_id IS NOT NULL
           GROUP BY variant_id ORDER BY cnt DESC LIMIT 10""",
        shop_id,
        cutoff_dt,
    )
    top_products = [{"variant_id": r["variant_id"], "orders": r["cnt"]} for r in product_rows]

    return {
        "form_opens": form_opens,
        "orders": order_count,
        "revenue": round(total_revenue, 2),
        "conversion_rate": conversion_rate,
        "avg_order_value": avg_order_value,
        "daily": daily,
        "utm_data": utm_data,
        "top_products": top_products,
        "period_days": days,
    }


def _date_range(days: int) -> list[str]:
    today = datetime.now(tz=UTC).date()
    return [(today - timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]
