"""SmartRecruiters ATS handler."""

from __future__ import annotations

import logging

from playwright.async_api import Page

from app.services.ats_router import ApplyResult

logger = logging.getLogger(__name__)


async def handle_smartrecruiters(
    page: Page, job: dict, profile: dict, resume_path: str | None = None, user_id=None
) -> ApplyResult:
    """Apply via SmartRecruiters ATS."""
    url = job.get("apply_url", "") or job.get("external_url", "")

    try:
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        fields = {
            'input[name*="firstName"]': profile.get("first_name", ""),
            'input[name*="lastName"]': profile.get("last_name", ""),
            'input[name*="email"]': profile.get("email", ""),
            'input[name*="phone"]': profile.get("phone", ""),
        }

        for selector, value in fields.items():
            field = page.locator(selector)
            if await field.count() > 0 and value:
                await field.first.fill(value)

        if resume_path:
            file_input = page.locator('input[type="file"]')
            if await file_input.count() > 0:
                await file_input.first.set_input_files(resume_path)

        submit_btn = page.locator('button[type="submit"], input[type="submit"]')
        if await submit_btn.count() > 0:
            await submit_btn.first.click()
            await page.wait_for_timeout(3000)
            screenshot = await page.screenshot()
            return ApplyResult(success=True, platform="smartrecruiters", screenshot=screenshot)

        return ApplyResult(success=False, platform="smartrecruiters", error="No submit button found")

    except Exception as e:
        logger.error(f"SmartRecruiters apply failed: {e}", exc_info=True)
        screenshot = await page.screenshot() if page else None
        return ApplyResult(success=False, platform="smartrecruiters", error=str(e), screenshot=screenshot)