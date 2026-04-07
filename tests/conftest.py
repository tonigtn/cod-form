"""Shared test fixtures for COD Form APP."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def mock_pool():
    """Mock the DB pool for all tests."""
    with patch("app.db.pool._pool") as mock:
        pool = MagicMock()
        pool.execute = AsyncMock(return_value="OK")
        pool.fetch = AsyncMock(return_value=[])
        pool.fetchrow = AsyncMock(return_value=None)
        pool.fetchval = AsyncMock(return_value=None)
        mock.return_value = pool

        # Patch the module-level functions
        with (
            patch("app.db.pool.execute", pool.execute),
            patch("app.db.pool.fetch", pool.fetch),
            patch("app.db.pool.fetchrow", pool.fetchrow),
            patch("app.db.pool.fetchval", pool.fetchval),
        ):
            yield pool


@pytest.fixture()
def client(mock_pool):
    """FastAPI test client with mocked DB."""
    from app.main import app
    from app.session import _verify_session_token

    def _fake_verify():
        return {"shop": "test-store.myshopify.com", "sub": "1"}

    app.dependency_overrides[_verify_session_token] = _fake_verify
    yield TestClient(app)
    app.dependency_overrides.clear()
