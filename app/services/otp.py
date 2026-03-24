"""OTP verification for COD orders — in-memory store, WhatsApp delivery."""

from __future__ import annotations

import os
import re
import secrets
import time
from typing import Any

import httpx
import structlog

log = structlog.get_logger(__name__)

# In-memory OTP store: key -> (code, expires_at, attempts)
_otp_store: dict[str, tuple[str, float, int]] = {}

_OTP_TTL = 600  # 10 minutes
_OTP_MAX_ATTEMPTS = 3
_OTP_LENGTH = 6
_GRAPH_URL = "https://graph.facebook.com/v21.0"
_TIMEOUT = 15.0


def _phone_key(shop: str, phone: str) -> str:
    cleaned = re.sub(r"[\s\-().]+", "", phone)
    return f"{shop}:{cleaned}"


def _normalize_phone(phone: str, country_code: str = "RO") -> str:
    """Normalize phone to E.164 format."""
    cleaned = re.sub(r"[\s\-().]+", "", phone)
    if country_code == "GR":
        if cleaned.startswith("+30"):
            return cleaned
        if cleaned.startswith("30") and len(cleaned) == 12:
            return "+" + cleaned
        if re.match(r"^69\d{8}$", cleaned):
            return "+30" + cleaned
        return ""
    # Romanian default
    if cleaned.startswith("+40"):
        return cleaned
    if cleaned.startswith("40") and len(cleaned) == 11:
        return "+" + cleaned
    if re.match(r"^0[2-9]\d{8}$", cleaned):
        return "+40" + cleaned[1:]
    return ""


def _cleanup_expired() -> None:
    now = time.monotonic()
    expired = [k for k, v in _otp_store.items() if v[1] < now]
    for k in expired:
        del _otp_store[k]


def generate_otp(shop: str, phone: str) -> str:
    """Generate and store a 6-digit OTP code."""
    _cleanup_expired()
    key = _phone_key(shop, phone)
    code = "".join(str(secrets.randbelow(10)) for _ in range(_OTP_LENGTH))
    expires = time.monotonic() + _OTP_TTL
    _otp_store[key] = (code, expires, 0)
    log.info("otp_generated", shop=shop, phone_last4=phone[-4:])
    return code


def verify_otp(shop: str, phone: str, code: str) -> tuple[bool, str]:
    """Verify an OTP code. Returns (success, error_message)."""
    _cleanup_expired()
    key = _phone_key(shop, phone)
    entry = _otp_store.get(key)

    if not entry:
        return False, "Codul a expirat. Solicită un cod nou."

    stored_code, expires, attempts = entry

    if time.monotonic() > expires:
        del _otp_store[key]
        return False, "Codul a expirat. Solicită un cod nou."

    if attempts >= _OTP_MAX_ATTEMPTS:
        del _otp_store[key]
        return False, "Prea multe încercări. Solicită un cod nou."

    if code != stored_code:
        _otp_store[key] = (stored_code, expires, attempts + 1)
        remaining = _OTP_MAX_ATTEMPTS - attempts - 1
        return False, f"Cod incorect. Mai ai {remaining} încercări."

    del _otp_store[key]
    log.info("otp_verified", shop=shop, phone_last4=phone[-4:])
    return True, ""


async def send_otp_whatsapp(
    phone: str,
    code: str,
    whatsapp_phone_number_id: str,
    locale: str = "ro",
) -> bool:
    """Send OTP code via WhatsApp template message."""
    if not whatsapp_phone_number_id:
        return False

    access_token = os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
    if not access_token:
        return False

    country = "GR" if locale == "el" else "RO"
    normalized = _normalize_phone(phone, country_code=country)
    if not normalized:
        return False

    recipient = normalized.lstrip("+")

    payload: dict[str, Any] = {
        "messaging_product": "whatsapp",
        "to": recipient,
        "type": "template",
        "template": {
            "name": "otp_verification",
            "language": {"code": locale},
            "components": [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": code}],
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
            return True
    except Exception as exc:
        log.warning("otp_whatsapp_failed", error=str(exc))
        return False
