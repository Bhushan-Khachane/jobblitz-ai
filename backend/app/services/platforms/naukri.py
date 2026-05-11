"""Naukri direct apply handler."""

from __future__ import annotations

import logging

from playwright.async_api import Page

from app.services.ats_router import ApplyResult

logger = logging.getLogger(__name__)


async def handle_naukri_direct(
    page: Page, job: dict, profile: dict, resume_path: str | None = None
) -> ApplyResult:
    """Apply to a Naukri job listing.

    Naukri requires login. The apply flow involves:
    1. Navigate to the job listing
    2. Click Apply button
    3. Fill application form fields
    4. Submit
    """
    url = job.get("apply_url", "") or job.get("external_url", "")

    try:
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        # Look for Apply button
        apply_btn = page.locator('button:has-text("Apply")')
        if await apply_btn.count() == 0:
            # Check if it's an external apply (redirect)
            external_btn = page.locator('a:has-text("Apply")')
            if await external_btn.count() > 0:
                return ApplyResult(success=False, platform="naukri", error="External apply — redirect to company site")

            return ApplyResult(success=False, platform="naukri", error="No Apply button found")

        await apply_btn.first.click()
        await page.wait_for_timeout(3000)

        # Fill form fields if they appear
        name_input = page.locator('input[name="name"], input[placeholder*="name"]')
        if await name_input.count() > 0:
            await name_input.first.fill(profile.get("full_name", ""))

        email_input = page.locator('input[name="email"], input[type="email"]')
        if await email_input.count() > 0:
            await email_input.first.fill(profile.get("email", ""))

        # Upload resume if available
        if resume_path:
            file_input = page.locator('input[type="file"]')
            if await file_input.count() > 0:
                await file_input.first.set_input_files(resume_path)

        # Submit
        submit_btn = page.locator('button:has-text("Submit"), button:has-text("Apply")')
        if await submit_btn.count() > 0:
            await submit_btn.last.click()
            await page.wait_for_timeout(3000)
            screenshot = await page.screenshot()
            return ApplyResult(success=True, platform="naukri", screenshot=screenshot)

        return ApplyResult(success=False, platform="naukri", error="Could not find submit button")

    except Exception as e:
        logger.error(f"Naukri apply failed: {e}", exc_info=True)
        screenshot = await page.screenshot() if page else None
        return ApplyResult(success=False, platform="naukri", error=str(e), screenshot=screenshot)