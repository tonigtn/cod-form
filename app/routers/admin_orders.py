"""Admin API: order list, stats, and CSV export — DB-backed."""

from __future__ import annotations

import csv
import io
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.db import pool
from app.session import SessionUser
from app.shopify.tokens import get_shop_id_or_raise

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/admin/orders", tags=["admin-orders"])


async def _get_shop_id(user: SessionUser) -> int:
    return await get_shop_id_or_raise(user["shop"])


@router.get("/stats")
async def order_stats(
    _user: SessionUser,
    days: int = Query(default=7, ge=1, le=90),
) -> dict[str, Any]:
    """Return order stats for the session's shop."""
    shop_id = await _get_shop_id(_user)
    cutoff = datetime.now(tz=UTC) - timedelta(days=days)

    # Total counts
    total_all = await pool.fetchval("SELECT COUNT(*) FROM orders WHERE shop_id = $1", shop_id)
    total_recent = await pool.fetchval(
        "SELECT COUNT(*) FROM orders WHERE shop_id = $1 AND created_at > $2",
        shop_id,
        cutoff,
    )

    # Daily counts
    rows = await pool.fetch(
        """SELECT created_at::date as day, COUNT(*) as cnt
           FROM orders WHERE shop_id = $1 AND created_at > $2
           GROUP BY day ORDER BY day""",
        shop_id,
        cutoff,
    )
    daily = {str(r["day"]): r["cnt"] for r in rows}

    # Top cities
    city_rows = await pool.fetch(
        """SELECT city, COUNT(*) as cnt FROM orders
           WHERE shop_id = $1 AND created_at > $2
           GROUP BY city ORDER BY cnt DESC LIMIT 5""",
        shop_id,
        cutoff,
    )
    top_cities = [{"city": r["city"], "count": r["cnt"]} for r in city_rows]

    return {
        "total_orders": total_recent or 0,
        "total_all_time": total_all or 0,
        "daily_counts": daily,
        "top_cities": top_cities,
        "period_days": days,
    }


@router.get("/export")
async def export_orders_csv(
    _user: SessionUser,
    date_from: str = Query(default=""),
    date_to: str = Query(default=""),
) -> StreamingResponse:
    """Export orders as CSV download."""
    shop_id = await _get_shop_id(_user)

    conditions = ["shop_id = $1"]
    args: list[Any] = [shop_id]
    idx = 1

    if date_from:
        idx += 1
        conditions.append(f"created_at::date >= ${idx}::date")
        args.append(date_from)
    if date_to:
        idx += 1
        conditions.append(f"created_at::date <= ${idx}::date")
        args.append(date_to)

    where = " AND ".join(conditions)
    rows = await pool.fetch(
        f"""SELECT created_at, order_name, phone_last4, city, province, zip, quantity, variant_id
            FROM orders WHERE {where} ORDER BY created_at DESC""",
        *args,
    )

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Date", "Order", "Phone", "City", "Province", "ZIP", "Qty", "Variant ID"])
    for r in rows:
        writer.writerow(
            [
                str(r["created_at"])[:19],
                r["order_name"] or "",
                f"***{r['phone_last4'] or ''}",
                r["city"] or "",
                r["province"] or "",
                r["zip"] or "",
                r["quantity"] or 1,
                r["variant_id"] or "",
            ]
        )

    buf.seek(0)
    filename = f"orders_{datetime.now(tz=UTC).strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("")
async def list_orders(
    _user: SessionUser,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    search: str = Query(default=""),
    date_from: str = Query(default=""),
    date_to: str = Query(default=""),
) -> dict[str, Any]:
    """Return paginated orders (newest first)."""
    shop_id = await _get_shop_id(_user)

    conditions = ["shop_id = $1"]
    args: list[Any] = [shop_id]
    idx = 1

    if search:
        idx += 1
        conditions.append(
            f"(order_name ILIKE ${idx} OR phone_last4 ILIKE ${idx} OR city ILIKE ${idx})"
        )
        args.append(f"%{search}%")
    if date_from:
        idx += 1
        conditions.append(f"created_at::date >= ${idx}::date")
        args.append(date_from)
    if date_to:
        idx += 1
        conditions.append(f"created_at::date <= ${idx}::date")
        args.append(date_to)

    where = " AND ".join(conditions)

    total = await pool.fetchval(f"SELECT COUNT(*) FROM orders WHERE {where}", *args)

    offset = (page - 1) * limit
    idx += 1
    limit_param = idx
    idx += 1
    offset_param = idx

    rows = await pool.fetch(
        f"""SELECT created_at, order_name, shopify_order_id, phone_last4,
                   city, province, zip, quantity, variant_id
            FROM orders WHERE {where}
            ORDER BY created_at DESC
            LIMIT ${limit_param} OFFSET ${offset_param}""",
        *args,
        limit,
        offset,
    )

    orders = [
        {
            "created_at": r["created_at"].isoformat() if r["created_at"] else "",
            "order_name": r["order_name"] or "",
            "order_id": r["shopify_order_id"] or 0,
            "phone_last4": r["phone_last4"] or "",
            "city": r["city"] or "",
            "province": r["province"] or "",
            "zip": r["zip"] or "",
            "quantity": r["quantity"] or 1,
            "variant_id": r["variant_id"] or 0,
        }
        for r in rows
    ]

    total_count = total or 0
    return {
        "orders": orders,
        "total": total_count,
        "page": page,
        "limit": limit,
        "pages": (total_count + limit - 1) // limit if total_count > 0 else 0,
    }
