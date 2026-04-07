"""Tests for storefront API endpoints."""

from __future__ import annotations

from app.routers.storefront import _is_rate_limited, _resolve_shop_param


class TestResolveShop:
    def test_shop_param_preferred(self) -> None:
        assert _resolve_shop_param("test.myshopify.com", "store_1") == "test.myshopify.com"

    def test_legacy_store_id(self) -> None:
        assert _resolve_shop_param("", "store_1") == "rmeai1-da.myshopify.com"

    def test_unknown_legacy(self) -> None:
        assert _resolve_shop_param("", "store_99") == "store_99"

    def test_empty(self) -> None:
        assert _resolve_shop_param("", "") == ""


class TestRateLimiting:
    def test_under_limit(self) -> None:
        # Fresh IP should not be limited
        assert _is_rate_limited("test_ip_unique_1") is False

    def test_at_limit(self) -> None:
        ip = "test_ip_rate_limit"
        for _ in range(5):
            _is_rate_limited(ip)
        assert _is_rate_limited(ip) is True
