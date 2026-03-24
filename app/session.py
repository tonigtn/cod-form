"""Shopify App Bridge session token verification + HMAC-based fallback."""

from __future__ import annotations

import time
from typing import Annotated, Any

import jwt
import structlog
from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth import verify_query_hmac
from app.config import get_all_app_credentials, get_client_secret

log = structlog.get_logger(__name__)

router = APIRouter(tags=["admin-auth"])

_ADMIN_TOKEN_ISSUER = "cod-admin"
_ADMIN_TOKEN_TTL = 86400  # 24 hours


def _issue_admin_token(shop: str, secret: str = "") -> str:
    """Issue a JWT for admin API access after HMAC verification."""
    now = int(time.time())
    payload = {
        "shop": shop,
        "iss": _ADMIN_TOKEN_ISSUER,
        "iat": now,
        "exp": now + _ADMIN_TOKEN_TTL,
    }
    return jwt.encode(payload, secret or get_client_secret(), algorithm="HS256")


@router.post("/api/admin/token")
async def exchange_hmac_for_token(request: Request) -> dict[str, str]:
    """Exchange Shopify HMAC query params for an admin JWT."""
    body: dict[str, Any] = await request.json()
    query_string = "&".join(f"{k}={v}" for k, v in sorted(body.items()))

    matched_secret = ""
    for _cid, secret in get_all_app_credentials():
        if verify_query_hmac(query_string, secret):
            matched_secret = secret
            break

    if not matched_secret:
        raise HTTPException(status_code=401, detail="Invalid HMAC")

    shop = str(body.get("shop", ""))
    if not shop:
        raise HTTPException(status_code=400, detail="Missing shop parameter")

    token = _issue_admin_token(shop, matched_secret)
    log.info("cod_admin_token_issued", shop=shop)
    return {"token": token}


def _verify_session_token(request: Request) -> dict[str, str]:
    """Extract and verify session token from Authorization header."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing session token")

    token = auth[7:]
    last_error: Exception | None = None

    for client_id, secret in get_all_app_credentials():
        # Try Shopify App Bridge token
        try:
            payload: dict[str, Any] = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                audience=client_id,
            )
            dest = payload.get("dest", "")
            shop = dest.replace("https://", "").replace("http://", "").rstrip("/")
            return {"shop": shop, "sub": str(payload.get("sub", ""))}
        except jwt.ExpiredSignatureError as exc:
            raise HTTPException(status_code=401, detail="Session token expired") from exc
        except jwt.InvalidTokenError:
            pass

        # Try admin token
        try:
            payload = jwt.decode(token, secret, algorithms=["HS256"])
            if payload.get("iss") == _ADMIN_TOKEN_ISSUER:
                shop = str(payload.get("shop", ""))
                return {"shop": shop, "sub": "admin"}
        except jwt.ExpiredSignatureError as exc:
            raise HTTPException(status_code=401, detail="Session token expired") from exc
        except jwt.InvalidTokenError as exc:
            last_error = exc

    log.warning("cod_admin_invalid_token", error=str(last_error))
    raise HTTPException(status_code=401, detail="Invalid session token")


SessionUser = Annotated[dict[str, str], Depends(_verify_session_token)]


@router.get("/api/admin/me")
async def get_current_store(user: SessionUser) -> dict[str, object]:
    """Return the current store identity from the authenticated session."""
    from app.shopify.tokens import get_shop_info, list_shops

    shop = user["shop"]
    info = await get_shop_info(shop)
    if not info:
        raise HTTPException(status_code=403, detail=f"Shop not installed: {shop}")

    all_shops = await list_shops()

    return {
        "shop": shop,
        "store_name": info.get("store_name", shop),
        "locale": info.get("locale", "ro"),
        "currency": info.get("currency", "RON"),
        "all_stores": all_shops,
    }
