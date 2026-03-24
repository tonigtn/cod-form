"""Shopify OAuth2 install flow + HMAC verification."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from urllib.parse import urlencode

import httpx
import structlog
from fastapi import APIRouter, Query, Request
from fastapi.responses import RedirectResponse

from app.config import (
    REQUIRED_SCOPES,
    get_all_app_credentials,
    get_app_base_url,
    get_client_id,
    get_client_secret,
)
from app.shopify.tokens import store_token

log = structlog.get_logger(__name__)

router = APIRouter(tags=["auth"])

# In-memory nonce store for OAuth CSRF protection {nonce: (shop, client_id)}
_nonces: dict[str, tuple[str, str]] = {}


def _get_client_id_for_shop(shop: str) -> str:
    """Get the correct Shopify app client ID for a shop.

    Multiple Shopify apps may be used (e.g. one per group of stores).
    Falls back to the primary client ID for unknown shops.
    """
    import os

    # Check for explicit shop→client_id mapping in env
    # Format: SHOPIFY_SHOP_CLIENT_ID_<sanitized_domain>=<client_id>
    # Or use a simpler mapping approach
    mapping_str = os.environ.get("SHOPIFY_SHOP_CLIENT_MAP", "")
    if mapping_str:
        for pair in mapping_str.split(","):
            if "=" in pair:
                domain, cid = pair.strip().split("=", 1)
                if domain.strip() == shop:
                    return cid.strip()

    return get_client_id()


def _get_secret_for_client(client_id: str) -> str:
    """Get the secret matching a client ID."""
    for cid, secret in get_all_app_credentials():
        if cid == client_id:
            return secret
    return get_client_secret()


@router.get("/auth/install")
async def install(shop: str = Query(description="myshopify.com domain")) -> RedirectResponse:
    """Step 1: Redirect merchant to Shopify authorization page."""
    client_id = _get_client_id_for_shop(shop)
    if not client_id:
        log.error("oauth_missing_client_id")
        return RedirectResponse(url="/auth/error?msg=App+not+configured")

    nonce = secrets.token_urlsafe(32)
    _nonces[nonce] = (shop, client_id)

    redirect_uri = f"{get_app_base_url()}/auth/callback"
    params = urlencode(
        {
            "client_id": client_id,
            "scope": REQUIRED_SCOPES,
            "redirect_uri": redirect_uri,
            "state": nonce,
        }
    )

    auth_url = f"https://{shop}/admin/oauth/authorize?{params}"
    log.info("oauth_install_redirect", shop=shop)
    return RedirectResponse(url=auth_url)


@router.get("/auth/callback")
async def callback(
    request: Request,
    code: str = Query(description="Authorization code"),
    hmac_param: str = Query(alias="hmac", description="HMAC signature"),
    shop: str = Query(description="Shop domain"),
    state: str = Query(description="Nonce for CSRF"),
) -> RedirectResponse:
    """Step 2: Exchange authorization code for permanent access token."""
    nonce_data = _nonces.pop(state, None)
    if not nonce_data:
        log.warning("oauth_invalid_nonce", shop=shop, state=state)
        return RedirectResponse(url="/auth/error?msg=Invalid+state")

    expected_shop, used_client_id = nonce_data
    if expected_shop != shop:
        log.warning("oauth_shop_mismatch", shop=shop, expected=expected_shop)
        return RedirectResponse(url="/auth/error?msg=Invalid+state")

    used_secret = _get_secret_for_client(used_client_id)
    if not verify_query_hmac(str(request.query_params), used_secret):
        log.warning("oauth_invalid_hmac", shop=shop)
        return RedirectResponse(url="/auth/error?msg=Invalid+signature")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"https://{shop}/admin/oauth/access_token",
                json={
                    "client_id": used_client_id,
                    "client_secret": used_secret,
                    "code": code,
                },
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        log.error("oauth_token_exchange_failed", shop=shop, error=str(exc))
        return RedirectResponse(url="/auth/error?msg=Token+exchange+failed")

    access_token = data.get("access_token", "")
    if not access_token:
        log.error("oauth_no_token_in_response", shop=shop)
        return RedirectResponse(url="/auth/error?msg=No+token+received")

    await store_token(shop, access_token)
    log.info("oauth_install_complete", shop=shop, scope=data.get("scope", ""))

    return RedirectResponse(url=f"https://{shop}/admin/apps")


@router.get("/auth/error")
async def auth_error(msg: str = "Unknown error") -> dict[str, str]:
    return {"error": msg}


def verify_query_hmac(query_string: str, secret: str) -> bool:
    """Verify Shopify HMAC signature on OAuth callback query string."""
    if not secret:
        return False

    params: list[str] = []
    received_hmac = ""
    for pair in query_string.split("&"):
        if "=" not in pair:
            continue
        key, _, value = pair.partition("=")
        if key == "hmac":
            received_hmac = value
        else:
            params.append(pair)

    if not received_hmac:
        return False

    message = "&".join(sorted(params))
    computed = hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, received_hmac)


def verify_proxy_hmac(query_params: dict[str, str], secret: str) -> bool:
    """Verify Shopify HMAC signature on app proxy requests."""
    if not secret:
        return False

    signature = query_params.get("signature", "")
    if not signature:
        return False

    pairs = sorted(f"{k}={v}" for k, v in query_params.items() if k != "signature")
    message = "&".join(pairs)
    computed = hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, signature)
