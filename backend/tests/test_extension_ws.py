import pytest
from unittest.mock import AsyncMock, patch

from app.services.extension_manager import ExtensionManager, extension_manager


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


def test_extension_manager_singleton_consistency():
    """All imports must reference the same singleton object."""
    from app.services.extension_manager import extension_manager as em1
    from app.routers.extension_ws import extension_manager as em2

    assert em1 is em2, "Router and service must use the same singleton"
    assert em1 is extension_manager, "All imports must point to the same object"


@pytest.mark.asyncio
async def test_extension_manager_handle_extension_ready():
    """extension_ready message should not crash."""
    mgr = ExtensionManager()
    await mgr.handle_message("user-123", {"type": "extension_ready"})


@pytest.mark.asyncio
async def test_extension_manager_handle_unknown_message():
    """Unknown message types should not crash."""
    mgr = ExtensionManager()
    await mgr.handle_message("user-123", {"type": "unknown_event"})


@pytest.mark.asyncio
async def test_extension_manager_handle_apply_status_missing_fields():
    """apply_status with missing app_id/status should not crash."""
    mgr = ExtensionManager()
    await mgr.handle_message("user-123", {"type": "apply_status", "application_id": None, "status": "applied"})
    await mgr.handle_message("user-123", {"type": "apply_status", "application_id": "abc", "status": None})


@pytest.mark.asyncio
async def test_extension_manager_apply_status_updates_db():
    """apply_status should trigger DB update via _update_application_status."""
    mgr = ExtensionManager()

    with patch.object(mgr, "_update_application_status", new_callable=AsyncMock) as mock_update:
        await mgr.handle_message("user-123", {
            "type": "apply_status",
            "application_id": "app-001",
            "status": "applied",
            "message": "Success",
        })
        mock_update.assert_awaited_once_with(app_id="app-001", status="applied", message="Success")
