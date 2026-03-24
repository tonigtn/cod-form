"""FastAPI app — COD Order Form standalone Shopify app."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import TYPE_CHECKING

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.auth import router as auth_router
from app.db.pool import close_pool, init_pool
from app.routers.admin_analytics import router as analytics_router
from app.routers.admin_blacklist import router as blacklist_router
from app.routers.admin_config import router as config_router
from app.routers.admin_orders import router as orders_router
from app.routers.admin_products import router as products_router
from app.routers.storefront import router as storefront_router
from app.session import router as session_router

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

log = structlog.get_logger(__name__)

_WEB_DIST = Path(__file__).resolve().parent.parent / "web" / "dist"


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Initialize DB pool on startup, close on shutdown."""
    await init_pool()
    log.info("cod_app_started")
    yield
    await close_pool()
    log.info("cod_app_stopped")


app = FastAPI(
    title="COD Order Form App",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    lifespan=lifespan,
)

# ── Routers ────────────────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(session_router)
app.include_router(storefront_router)
app.include_router(config_router)
app.include_router(orders_router)
app.include_router(analytics_router)
app.include_router(blacklist_router)
app.include_router(products_router)

# ── Middleware ──────────────────────────────────────────────────────────────

_CSP = "frame-ancestors https://admin.shopify.com https://*.myshopify.com;"


class ShopifyEmbedMiddleware(BaseHTTPMiddleware):
    """Add required headers for Shopify embedded app."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        if request.url.path.startswith("/admin"):
            response.headers["Content-Security-Policy"] = _CSP
        return response


app.add_middleware(ShopifyEmbedMiddleware)

# CORS — allow all Shopify origins (any myshopify.com store)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.myshopify\.com|https://admin\.shopify\.com|https://.*",
    allow_methods=["POST", "GET", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-COD-Key", "Authorization"],
    allow_credentials=False,
)


# ── Admin SPA serving ──────────────────────────────────────────────────────

if _WEB_DIST.is_dir():
    _assets_dir = _WEB_DIST / "assets"
    if _assets_dir.is_dir():
        app.mount("/admin/assets", StaticFiles(directory=str(_assets_dir)), name="admin-assets")

    _INDEX_HTML = (_WEB_DIST / "index.html").read_text()

    def _dynamic_index(shop: str) -> Response:
        """Serve index.html with the correct shopify-api-key for this shop."""
        from app.auth import _get_client_id_for_shop

        client_id = _get_client_id_for_shop(shop)
        html = _INDEX_HTML.replace("__SHOPIFY_API_KEY__", client_id)
        return Response(
            content=html,
            media_type="text/html",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
        )

    @app.get("/admin/{path:path}")
    async def admin_spa(path: str, request: Request) -> Response:
        """Serve admin SPA — returns index.html for all non-file routes."""
        file_path = _WEB_DIST / path
        if file_path.is_file() and ".." not in path:
            return FileResponse(str(file_path))
        shop = request.query_params.get("shop", "")
        return _dynamic_index(shop)

    @app.get("/admin")
    async def admin_root(request: Request) -> Response:
        """Serve admin SPA root."""
        shop = request.query_params.get("shop", "")
        return _dynamic_index(shop)


# ── Error handling ─────────────────────────────────────────────────────────


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Return friendly validation errors."""
    return JSONResponse(
        status_code=200,
        content={
            "success": False,
            "order_name": "",
            "order_id": 0,
            "error": "Date invalide. Verifică câmpurile.",
        },
    )
