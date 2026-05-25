import uuid
from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_apply_to_job_rate_limit_denies():
    """When velocity governor denies, apply should return gracefully without opening browser."""
    with patch("app.services.apply_service.can_apply", new_callable=AsyncMock) as mock_can:
        mock_can.return_value = (False, "Daily limit reached")

        from app.services.apply_service import apply_to_job

        ok, err, screenshot, answers = await apply_to_job(
            apply_url="https://www.naukri.com/job/test-123",
            user_id=uuid.uuid4(),
            profile={"first_name": "Test", "email": "test@test.com"},
            platform="naukri",
            username="test",
            encrypted_password="enc_pass",
        )

        assert not ok
        assert "Daily limit reached" in err
        assert screenshot is None
        assert answers == {}


@pytest.mark.asyncio
async def test_apply_to_job_prefers_extension_when_connected():
    """When extension is connected and dispatch succeeds, Playwright fallback is NOT used."""
    with patch("app.services.apply_service.can_apply", new_callable=AsyncMock) as mock_can:
        mock_can.return_value = (True, "ok")

        with patch("app.services.apply_service.record_apply", new_callable=AsyncMock) as mock_record:
            with patch("app.services.apply_service.extension_manager") as mock_em:
                mock_em.is_connected.return_value = True
                mock_em.send_apply_job = AsyncMock(return_value=True)

                with patch("app.services.browser_pool.browser_pool.acquire_for_user") as mock_acquire:
                    from app.services.apply_service import apply_to_job

                    ok, err, screenshot, answers = await apply_to_job(
                        apply_url="https://www.naukri.com/job/test-123",
                        user_id=uuid.uuid4(),
                        profile={"first_name": "Test", "email": "test@test.com"},
                        platform="naukri",
                        username="test",
                        encrypted_password="enc_pass",
                        application_id="app-id-001",
                    )

                    assert ok is True
                    assert err is None
                    assert screenshot is None
                    assert answers == {}
                    mock_em.is_connected.assert_called_once()
                    mock_em.send_apply_job.assert_awaited_once()
                    mock_acquire.assert_not_called()
                    mock_record.assert_awaited_once()


@pytest.mark.asyncio
async def test_apply_to_job_falls_back_when_extension_not_connected():
    """When extension is not connected, fallback path is used."""
    with patch("app.services.apply_service.can_apply", new_callable=AsyncMock) as mock_can:
        mock_can.return_value = (True, "ok")

        with patch("app.services.apply_service.record_apply", new_callable=AsyncMock) as mock_record:
            with patch("app.services.apply_service.extension_manager") as mock_em:
                mock_em.is_connected.return_value = False

                mock_ctx = AsyncMock()
                mock_page = AsyncMock()
                mock_ctx.new_page = AsyncMock(return_value=mock_page)

                with patch("app.services.browser_pool.browser_pool.acquire_for_user", new_callable=AsyncMock, return_value=mock_ctx):
                    mock_page.url = "https://www.naukri.com/login"
                    mock_page.goto = AsyncMock()
                    with patch("app.services.apply_service._save_screenshot", new_callable=AsyncMock):
                        from app.services.apply_service import apply_to_job

                        ok, err, screenshot, answers = await apply_to_job(
                            apply_url="https://www.naukri.com/job/test-123",
                            user_id=uuid.uuid4(),
                            profile={"first_name": "Test", "email": "test@test.com"},
                            platform="naukri",
                            username="test",
                            encrypted_password="enc_pass",
                            application_id="app-id-001",
                        )

                        assert not ok
                        assert "login" in err.lower()
                        mock_record.assert_not_called()


@pytest.mark.asyncio
async def test_apply_to_job_generates_cover_letter_when_missing():
    """If cover_letter is missing and job context provided, generate one."""
    with patch("app.services.apply_service.can_apply", new_callable=AsyncMock) as mock_can:
        mock_can.return_value = (True, "ok")

        with patch("app.services.apply_service.generate_unique_cover_letter", new_callable=AsyncMock) as mock_cl:
            mock_cl.return_value = "Generated cover letter text"

            with patch("app.services.apply_service.extension_manager") as mock_em:
                mock_em.is_connected.return_value = True
                mock_em.send_apply_job = AsyncMock(return_value=True)

                with patch("app.services.apply_service.record_apply", new_callable=AsyncMock):
                    from app.services.apply_service import apply_to_job

                    ok, err, screenshot, answers = await apply_to_job(
                        apply_url="https://www.naukri.com/job/test-123",
                        user_id=uuid.uuid4(),
                        profile={"first_name": "Test", "email": "test@test.com", "full_name": "Test User"},
                        platform="naukri",
                        username="test",
                        encrypted_password="enc_pass",
                        application_id="app-id-001",
                        job_title="Software Engineer",
                        company="TestCorp",
                        job_description="Build things",
                    )

                    assert ok is True
                    mock_cl.assert_awaited_once()


@pytest.mark.asyncio
async def test_browser_pool_acquire_for_user_uses_proxy():
    """acquire_for_user should ask proxy_service for a user-specific proxy."""
    with patch("app.services.browser_pool.browser_pool._browser") as mock_browser:
        mock_ctx = AsyncMock()
        mock_browser.new_context = AsyncMock(return_value=mock_ctx)

        with patch("app.services.proxy_service.get_user_proxy") as mock_get_proxy:
            mock_get_proxy.return_value = {"server": "http://user:pass@proxy:8080"}

            from app.services.browser_pool import browser_pool
            browser_pool._initialized = True
            browser_pool._playwright = AsyncMock()

            ctx = await browser_pool.acquire_for_user("user-789", task_type="apply")

            mock_get_proxy.assert_called_once_with("user-789")
            mock_browser.new_context.assert_awaited_once()
            call_kwargs = mock_browser.new_context.await_args.kwargs
            assert call_kwargs.get("proxy") == {"server": "http://user:pass@proxy:8080"}
