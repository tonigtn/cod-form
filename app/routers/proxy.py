"""App Proxy router — mirrors storefront endpoints with Shopify HMAC verification.

Shopify proxies storefront requests through /apps/cod-form/* to this backend.
Every request includes a `signature` query param verified against the app secret.
"""

from __future__ import annotations

from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth import verify_proxy_hmac
from app.config import get_all_app_credentials

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/apps/cod-form", tags=["proxy"])


async def _verify_proxy(request: Request) -> str:
    """Verify Shopify app proxy HMAC signature. Returns shop domain."""
    params = dict(request.query_params)
    shop = params.get("shop", "")

    if not shop:
        raise HTTPException(status_code=401, detail="Missing shop parameter")

    # Try all registered app credentials
    for _cid, secret in get_all_app_credentials():
        if verify_proxy_hmac(params, secret):
            return shop

    log.warning("proxy_hmac_invalid", shop=shop)
    raise HTTPException(status_code=401, detail="Invalid proxy signature")


@router.api_route("/api/cod/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_passthrough(
    path: str,
    request: Request,
    shop: str = Depends(_verify_proxy),
) -> Any:
    """Forward verified proxy requests to the storefront router.

    Strips the /apps/cod-form prefix and forwards to /api/cod/{path}.
    Injects the verified shop domain into the request.
    """
    from starlette.datastructures import QueryParams
    from starlette.requests import Request as StarletteRequest

    # Build the internal URL
    internal_path = f"/api/cod/{path}"

    # Merge query params, ensuring shop is set
    params = dict(request.query_params)
    params["shop"] = shop
    # Remove proxy-specific params
    for key in ("signature", "path_prefix", "timestamp", "logged_in_customer_id"):
        params.pop(key, None)

    # Forward the request internally via the ASGI app
    from app.main import app

    # Build scope for internal request
    scope = dict(request.scope)
    scope["path"] = internal_path
    scope["query_string"] = "&".join(f"{k}={v}" for k, v in params.items()).encode()
    scope["headers"] = [
        (k, v) for k, v in request.scope.get("headers", [])
        if k != b"host"
    ] + [(b"host", b"localhost")]

    # Use httpx to make internal request
    import httpx

    body = await request.body()
    method = request.method

    async with httpx.AsyncClient(app=app, base_url="http://internal") as client:
        resp = await client.request(
            method=method,
            url=internal_path,
            params=params,
            content=body if method in ("POST", "PUT") else None,
            headers={
                "content-type": request.headers.get("content-type", "application/json"),
                "x-forwarded-for": request.client.host if request.client else "",
            },
            timeout=30.0,
        )

    return resp.json()
