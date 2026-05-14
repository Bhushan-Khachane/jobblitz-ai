import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.extension_manager import ExtensionManager


@pytest.mark.asyncio
async def test_extension_manager_connect_disconnect():
    """ExtensionManager tracks connections correctly."""
    mgr = ExtensionManager()
    ws = AsyncMock()
    ws.accept = AsyncMock()
    await mgr.connect("user-123", ws)
    assert mgr.is_connected("user-123")
    mgr.disconnect("user-123")
    assert not mgr.is_connected("user-123")


@pytest.mark.asyncio
async def test_extension_manager_send_apply_job():
    """ExtensionManager can dispatch apply jobs."""
    mgr = ExtensionManager()
    ws = AsyncMock()
    ws.send_text = AsyncMock()
    await mgr.connect("user-456", ws)
    ok = await mgr.send_apply_job("user-456", {"job_url": "https://example.com/job"})
    assert ok is True
    ws.send_text.assert_awaited_once()
