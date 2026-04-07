"""OTP verification for COD orders — DB-backed store, WhatsApp delivery."""

from __future__ import annotations

import hashlib
import os
import re
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import structlog

from app.db import pool

log = structlog.get_logger(__name__)

_OTP_TTL = 600  # 10 minutes
_OTP_MAX_ATTEMPTS = 3
_OTP_LENGTH = 6
_GRAPH_URL = "https://graph.facebook.com/v21.0"
_TIMEOUT = 15.0


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()[:32]


def _hash_phone(phone: str) -> str:
    cleaned = re.sub(r"[\s\-().]+", "", phone)
    return hashlib.sha256(cleaned.encode()).hexdigest()[:16]


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
    if country_code == "PL":
        if cleaned.startswith("+48"):
            return cleaned
        if not cleaned.startswith("+"):
            return "+48" + cleaned
        return cleaned
    # Romanian default
    if cleaned.startswith("+40"):
        return cleaned
    if cleaned.startswith("40") and len(cleaned) == 11:
        return "+" + cleaned
    if re.match(r"^0[2-9]\d{8}$", cleaned):
        return "+40" + cleaned[1:]
    return ""


async def generate_otp(shop_id: int, phone: str) -> str:
    """Generate and store a 6-digit OTP code in DB."""
    # Cleanup expired codes
    await pool.execute("DELETE FROM otp_codes WHERE expires_at < NOW()")

    phone_hash = _hash_phone(phone)
    code = "".join(str(secrets.randbelow(10)) for _ in range(_OTP_LENGTH))
    code_hash = _hash_code(code)
    expires = datetime.now(tz=UTC) + timedelta(seconds=_OTP_TTL)

    await pool.execute(
        """
        INSERT INTO otp_codes (shop_id, phone_hash, code_hash, expires_at, attempts)
        VALUES ($1, $2, $3, $4, 0)
        ON CONFLICT (shop_id, phone_hash) DO UPDATE
        SET code_hash = $3, expires_at = $4, attempts = 0
        """,
        shop_id, phone_hash, code_hash, expires,
    )

    log.info("otp_generated", shop_id=shop_id, phone_last4=phone[-4:])
    return code


async def verify_otp(shop_id: int, phone: str, code: str) -> tuple[bool, str]:
    """Verify an OTP code. Returns (success, error_message)."""
    phone_hash = _hash_phone(phone)

    row = await pool.fetchrow(
        "SELECT code_hash, expires_at, attempts FROM otp_codes WHERE shop_id = $1 AND phone_hash = $2",
        shop_id, phone_hash,
    )

    if not row:
        return False, "Code expired. Request a new one."

    if datetime.now(tz=UTC) > row["expires_at"]:
        await pool.execute(
            "DELETE FROM otp_codes WHERE shop_id = $1 AND phone_hash = $2",
            shop_id, phone_hash,
        )
        return False, "Code expired. Request a new one."

    if row["attempts"] >= _OTP_MAX_ATTEMPTS:
        await pool.execute(
            "DELETE FROM otp_codes WHERE shop_id = $1 AND phone_hash = $2",
            shop_id, phone_hash,
        )
        return False, "Too many attempts. Request a new one."

    if _hash_code(code) != row["code_hash"]:
        await pool.execute(
            "UPDATE otp_codes SET attempts = attempts + 1 WHERE shop_id = $1 AND phone_hash = $2",
            shop_id, phone_hash,
        )
        remaining = _OTP_MAX_ATTEMPTS - row["attempts"] - 1
        return False, f"Wrong code. {remaining} attempts remaining."

    await pool.execute(
        "DELETE FROM otp_codes WHERE shop_id = $1 AND phone_hash = $2",
        shop_id, phone_hash,
    )
    log.info("otp_verified", shop_id=shop_id, phone_last4=phone[-4:])
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

    country = {"el": "GR", "pl": "PL"}.get(locale, "RO")
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
