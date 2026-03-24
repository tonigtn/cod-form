"""WhatsApp order confirmation for COD orders."""

from __future__ import annotations

import os
import re

import httpx
import structlog

log = structlog.get_logger(__name__)

_GRAPH_URL = "https://graph.facebook.com/v21.0"
_TIMEOUT = 15.0
_TEMPLATE_NAME = "order_confirmation_ro"
_TEMPLATE_LANG = "ro"

_RO_PHONE_RE = re.compile(r"^0[2-9]\d{8}$")


def _normalize_phone(phone: str) -> str:
    cleaned = re.sub(r"[\s\-().]+", "", phone)
    if cleaned.startswith("+40"):
        return cleaned
    if cleaned.startswith("40") and len(cleaned) == 11:
        return "+" + cleaned
    if _RO_PHONE_RE.match(cleaned):
        return "+40" + cleaned[1:]
    return ""


async def send_cod_order_confirmation(
    phone: str,
    first_name: str,
    order_name: str,
    total: str,
    store_name: str,
    whatsapp_phone_number_id: str,
) -> bool:
    """Send WhatsApp order confirmation. Returns True if sent."""
    if not whatsapp_phone_number_id:
        return False

    access_token = os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
    if not access_token:
        return False

    normalized = _normalize_phone(phone)
    if not normalized:
        return False

    recipient = normalized.lstrip("+")

    payload = {
        "messaging_product": "whatsapp",
        "to": recipient,
        "type": "template",
        "template": {
            "name": _TEMPLATE_NAME,
            "language": {"code": _TEMPLATE_LANG},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": first_name},
                        {"type": "text", "text": order_name},
                        {"type": "text", "text": store_name},
                        {"type": "text", "text": total},
                    ],
                },
            ],
        },
    }

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                f"{_GRAPH_URL}/{whatsapp_phone_number_id}/messages",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()
            log.info("cod_whatsapp_confirmation_sent", order_name=order_name)
            return True
    except Exception as exc:
        log.warning("cod_whatsapp_confirmation_failed", error=str(exc))
        return False
