"""Tests for billing plan enforcement."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.shopify.billing import (
    FREE_ORDER_LIMIT,
    PLANS,
    check_order_limit,
    get_plan_features,
    get_plan_limit,
    get_usage,
)


class TestPlanLimits:
    def test_free_limit(self) -> None:
        assert get_plan_limit("free") == FREE_ORDER_LIMIT
        assert get_plan_limit("nonexistent") == FREE_ORDER_LIMIT

    def test_pro_limit(self) -> None:
        assert get_plan_limit("pro") == 500

    def test_premium_unlimited(self) -> None:
        assert get_plan_limit("premium") >= 999_999

    def test_free_features(self) -> None:
        features = get_plan_features("free")
        assert "basic_form" in features
        assert "upsells" not in features

    def test_pro_features(self) -> None:
        features = get_plan_features("pro")
        assert "upsells" in features
        assert "bumps" in features
        assert "auto_discounts" not in features

    def test_premium_features(self) -> None:
        features = get_plan_features("premium")
        assert "auto_discounts" in features
        assert "priority_support" in features


class TestCheckOrderLimit:
    @pytest.mark.asyncio
    async def test_free_under_limit(self) -> None:
        with (
            patch("app.shopify.billing.pool") as mock_pool,
        ):
            mock_pool.fetchrow = AsyncMock(return_value={"id": 1, "plan": "free", "app_subscription_id": None})
            mock_pool.fetchval = AsyncMock(return_value=50)
            allowed, msg = await check_order_limit("test.myshopify.com")
            assert allowed is True
            assert msg == ""

    @pytest.mark.asyncio
    async def test_free_at_limit(self) -> None:
        with patch("app.shopify.billing.pool") as mock_pool:
            mock_pool.fetchrow = AsyncMock(return_value={"id": 1, "plan": "free", "app_subscription_id": None})
            mock_pool.fetchval = AsyncMock(return_value=80)
            allowed, msg = await check_order_limit("test.myshopify.com")
            assert allowed is False
            assert "limit" in msg.lower()

    @pytest.mark.asyncio
    async def test_premium_unlimited(self) -> None:
        with patch("app.shopify.billing.pool") as mock_pool:
            mock_pool.fetchrow = AsyncMock(return_value={"id": 1, "plan": "premium", "app_subscription_id": "gid://123"})
            mock_pool.fetchval = AsyncMock(return_value=99999)
            allowed, msg = await check_order_limit("test.myshopify.com")
            assert allowed is True
