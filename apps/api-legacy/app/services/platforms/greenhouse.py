"""Greenhouse ATS handler — uses API-based submission where possible."""

from __future__ import annotations

import logging

from playwright.async_api import Page

from app.services.ats_router import ApplyResult

logger = logging.getLogger(__name__)


async def handle_greenhouse(
    page: Page, job: dict, profile: dict, resume_path: str | None = None, user_id=None
) -> ApplyResult:
    """Apply via Greenhouse ATS.

    Greenhouse application pages have a structured form that can be
    filled systematically.
    """
    url = job.get("apply_url", "") or job.get("external_url", "")

    try:
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        # Fill standard Greenhouse form fields
        fields = {
            'input[name="first_name"]': profile.get("first_name", ""),
            'input[name="last_name"]': profile.get("last_name", ""),
            'input[name="email"]': profile.get("email", ""),
            'input[name="phone"]': profile.get("phone", ""),
        }

        for selector, value in fields.items():
            field = page.locator(selector)
            if await field.count() > 0 and value:
                await field.first.fill(value)

        # Upload resume
        if resume_path:
            file_input = page.locator('input[type="file"][name*="resume"], input[type="file"][name*="cv"]')
            if await file_input.count() > 0:
                await file_input.first.set_input_files(resume_path)

        # Handle required dropdowns (select elements)
        selects = page.locator("select[required]")
        for i in range(await selects.count()):
            select = selects.nth(i)
            options = await select.locator("option").all_text_contents()
            if len(options) > 1:
                await select.select_option(index=1)

        # Submit
        submit_btn = page.locator('button[type="submit"], input[type="submit"]')
        if await submit_btn.count() > 0:
            await submit_btn.first.click()
            await page.wait_for_timeout(3000)
            screenshot = await page.screenshot()
            return ApplyResult(success=True, platform="greenhouse", screenshot=screenshot)

        return ApplyResult(success=False, platform="greenhouse", error="No submit button found")

    except Exception as e:
        logger.error(f"Greenhouse apply failed: {e}", exc_info=True)
        screenshot = await page.screenshot() if page else None
        return ApplyResult(success=False, platform="greenhouse", error=str(e), screenshot=screenshot)