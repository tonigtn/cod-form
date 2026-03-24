"""COD form event tracking — DB-backed."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import structlog

from app.db import pool

log = structlog.get_logger(__name__)

_VALID_EVENT_TYPES = frozenset(
    {
        "form_open",
        "form_close",
        "order_success",
        "upsell_impression",
        "upsell_accept",
        "upsell_reject",
        "offer_impression",
        "offer_select",
        "bump_impression",
        "bump_accept",
        "downsell_impression",
        "downsell_accept",
        "otp_sent",
        "otp_verified",
        "otp_failed",
        "form_partial",
    }
)


async def log_event(
    event_type: str,
    shop_id: int,
    ip: str,
    *,
    product_id: int = 0,
    variant_id: int = 0,
    order_value: float = 0.0,
    utm_source: str = "",
    utm_medium: str = "",
    utm_campaign: str = "",
    extra: dict[str, Any] | None = None,
) -> bool:
    """Log a form event to the database."""
    if event_type not in _VALID_EVENT_TYPES:
        log.warning("cod_event_invalid_type", event_type=event_type)
        return False

    try:
        await pool.execute(
            """
            INSERT INTO events (shop_id, event_type, product_id, variant_id, order_value,
                                ip, utm_source, utm_medium, utm_campaign, extra)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
            """,
            shop_id,
            event_type,
            product_id or None,
            variant_id or None,
            order_value or None,
            ip,
            utm_source or None,
            utm_medium or None,
            utm_campaign or None,
            None,  # extra JSONB — not used in basic logging
        )
        return True
    except Exception as exc:
        log.error("cod_event_log_error", error=str(exc))
        return False


async def load_events(shop_id: int, since_iso: str = "") -> list[dict[str, Any]]:
    """Load events for a shop, optionally filtered by timestamp."""
    if since_iso:
        cutoff = datetime.fromisoformat(since_iso)
        rows = await pool.fetch(
            """SELECT event_type, product_id, variant_id, order_value,
                      utm_source, utm_medium, utm_campaign, created_at
               FROM events WHERE shop_id = $1 AND created_at > $2
               ORDER BY created_at""",
            shop_id,
            cutoff,
        )
    else:
        rows = await pool.fetch(
            """SELECT event_type, product_id, variant_id, order_value,
                      utm_source, utm_medium, utm_campaign, created_at
               FROM events WHERE shop_id = $1 ORDER BY created_at""",
            shop_id,
        )

    return [
        {
            "event": r["event_type"],
            "product_id": r["product_id"],
            "variant_id": r["variant_id"],
            "order_value": float(r["order_value"]) if r["order_value"] else 0,
            "utm_source": r["utm_source"] or "",
            "utm_medium": r["utm_medium"] or "",
            "utm_campaign": r["utm_campaign"] or "",
            "ts": r["created_at"].isoformat() if r["created_at"] else "",
        }
        for r in rows
    ]


async def get_event_counts(shop_id: int, days: int = 7) -> dict[str, int]:
    """Get event type counts for the last N days."""
    cutoff = datetime.now(tz=UTC) - timedelta(days=days)
    rows = await pool.fetch(
        """SELECT event_type, COUNT(*) as cnt
           FROM events WHERE shop_id = $1 AND created_at > $2
           GROUP BY event_type""",
        shop_id,
        cutoff,
    )
    return {r["event_type"]: r["cnt"] for r in rows}
