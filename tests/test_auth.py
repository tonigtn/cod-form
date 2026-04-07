"""Tests for OAuth HMAC verification."""

from __future__ import annotations

import hashlib
import hmac

from app.auth import verify_proxy_hmac, verify_query_hmac


class TestQueryHmac:
    def test_valid_hmac(self) -> None:
        secret = "test_secret_123"
        params = "code=abc&shop=test.myshopify.com&state=nonce123&timestamp=1234"
        computed = hmac.new(secret.encode(), params.encode(), hashlib.sha256).hexdigest()
        query = f"{params}&hmac={computed}"
        assert verify_query_hmac(query, secret) is True

    def test_invalid_hmac(self) -> None:
        assert verify_query_hmac("code=abc&hmac=invalid&shop=test.myshopify.com", "secret") is False

    def test_missing_hmac(self) -> None:
        assert verify_query_hmac("code=abc&shop=test.myshopify.com", "secret") is False

    def test_empty_secret(self) -> None:
        assert verify_query_hmac("hmac=abc", "") is False


class TestProxyHmac:
    def test_valid_signature(self) -> None:
        secret = "proxy_secret_456"
        params = {
            "shop": "test.myshopify.com",
            "path_prefix": "/apps/cod-form",
            "timestamp": "1234567890",
        }
        # Proxy HMAC uses NO separator between sorted pairs
        message = "".join(sorted(f"{k}={v}" for k, v in params.items()))
        sig = hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()
        params["signature"] = sig
        assert verify_proxy_hmac(params, secret) is True

    def test_invalid_signature(self) -> None:
        params = {"shop": "test.myshopify.com", "signature": "invalid"}
        assert verify_proxy_hmac(params, "secret") is False

    def test_missing_signature(self) -> None:
        params = {"shop": "test.myshopify.com"}
        assert verify_proxy_hmac(params, "secret") is False

    def test_no_separator_between_pairs(self) -> None:
        """Verify that proxy HMAC uses no separator (not &)."""
        secret = "test"
        params = {"a": "1", "b": "2"}
        # Correct: "a=1b=2" (no separator)
        message = "a=1b=2"
        sig = hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()
        params["signature"] = sig
        assert verify_proxy_hmac(params, secret) is True

        # Wrong: "a=1&b=2" (with & separator) should NOT match
        wrong_message = "a=1&b=2"
        wrong_sig = hmac.new(secret.encode(), wrong_message.encode(), hashlib.sha256).hexdigest()
        params["signature"] = wrong_sig
        assert verify_proxy_hmac(params, secret) is False
