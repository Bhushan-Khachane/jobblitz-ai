import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_can_apply_respects_daily_limit():
    """Daily limit must block apply when reached."""
    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(side_effect=lambda k: b"15" if "daily" in k else b"0")
    mock_redis.pipeline = MagicMock(return_value=AsyncMock())

    with patch("app.services.velocity_governor.get_redis", return_value=mock_redis):
        with patch("app.services.velocity_governor.is_working_hour", return_value=True):
            from app.services.velocity_governor import can_apply
            ok, reason = await can_apply("user-1", "naukri")
            assert not ok
            assert "daily limit" in reason.lower()


@pytest.mark.asyncio
async def test_working_hour_gate():
    """Applies must be blocked outside 8am-10pm."""
    with patch("app.services.velocity_governor.is_working_hour", return_value=False):
        from app.services.velocity_governor import can_apply
        ok, reason = await can_apply("user-1", "naukri")
        assert not ok
        assert "working hours" in reason.lower()


def test_human_delay_in_range():
    from app.services.velocity_governor import human_delay_seconds
    for _ in range(50):
        d = human_delay_seconds(45, 180)
        assert 45 <= d <= 180, f"Delay {d} outside [45,180]"
