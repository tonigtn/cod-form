"""Abandoned form recovery — DB-backed."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import structlog

from app.db import pool

log = structlog.get_logger(__name__)


async def log_abandoned(
    shop_id: int,
    phone: str,
    first_name: str,
    product_id: int,
    variant_id: int,
    unit_price: float,
    province: str = "",
    draft_gid: str = "",
) -> bool:
    """Log an abandoned form capture. Deduplicates by phone (updates existing)."""
    try:
        await pool.execute(
            """
            INSERT INTO abandoned_forms
                (shop_id, phone, first_name, product_id, variant_id, unit_price, province, draft_gid)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (shop_id, phone) DO UPDATE SET
                first_name = EXCLUDED.first_name,
                product_id = EXCLUDED.product_id,
                variant_id = EXCLUDED.variant_id,
                unit_price = EXCLUDED.unit_price,
                province = EXCLUDED.province,
                draft_gid = EXCLUDED.draft_gid,
                created_at = NOW(),
                recovered = FALSE,
                reminder_sent = FALSE
            """,
            shop_id,
            phone,
            first_name,
            product_id,
            variant_id,
            unit_price,
            province,
            draft_gid,
        )
        return True
    except Exception as exc:
        log.error("abandoned_log_error", error=str(exc))
        return False


async def mark_recovered(shop_id: int, phone: str) -> str:
    """Mark an abandoned form as recovered. Returns draft_gid if any."""
    try:
        row = await pool.fetchrow(
            """
            UPDATE abandoned_forms SET recovered = TRUE, recovered_at = NOW()
            WHERE shop_id = $1 AND phone = $2 AND recovered = FALSE
            RETURNING draft_gid
            """,
            shop_id,
            phone,
        )
        return row["draft_gid"] or "" if row else ""
    except Exception as exc:
        log.error("abandoned_mark_recovered_error", error=str(exc))
        return ""


async def get_abandoned_stats(shop_id: int) -> dict[str, int]:
    """Get abandoned form stats for a shop."""
    today = datetime.now(tz=UTC).date()
    row = await pool.fetchrow(
        """
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE created_at::date = $2) as today,
            COUNT(*) FILTER (WHERE recovered = TRUE) as recovered,
            COUNT(*) FILTER (WHERE reminder_sent = TRUE) as reminder_sent
        FROM abandoned_forms WHERE shop_id = $1
        """,
        shop_id,
        today,
    )
    if not row:
        return {"total": 0, "today": 0, "recovered": 0, "reminder_sent": 0}
    return {
        "total": row["total"],
        "today": row["today"],
        "recovered": row["recovered"],
        "reminder_sent": row["reminder_sent"],
    }


async def get_pending_reminders(
    shop_id: int, delay_minutes: int = 30, max_count: int = 50
) -> list[dict[str, Any]]:
    """Get abandonments ready for reminder."""
    cutoff = datetime.now(tz=UTC) - timedelta(minutes=delay_minutes)
    rows = await pool.fetch(
        """
        SELECT phone, first_name, product_id, variant_id, unit_price, province, draft_gid
        FROM abandoned_forms
        WHERE shop_id = $1 AND reminder_sent = FALSE AND recovered = FALSE AND created_at < $2
        ORDER BY created_at LIMIT $3
        """,
        shop_id,
        cutoff,
        max_count,
    )
    return [dict(r) for r in rows]
