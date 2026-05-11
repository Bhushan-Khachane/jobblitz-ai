"""Workday ATS handler — assisted mode only.

Workday applications are complex and vary significantly between instances.
In assisted mode, we open the browser, pre-fill what we can,
take a screenshot, and let the user complete the application.
"""

from __future__ import annotations

import logging

from playwright.async_api import Page

from app.services.ats_router import ApplyResult

logger = logging.getLogger(__name__)


async def handle_workday(
    page: Page, job: dict, profile: dict, resume_path: str | None = None
) -> ApplyResult:
    """Open Workday application page in assisted mode.

    Workday forms are too complex for full automation.
    We pre-fill what we can and return a screenshot for the user to complete.
    """
    url = job.get("apply_url", "") or job.get("external_url", "")

    try:
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(3000)

        # Attempt to fill basic fields
        fields = {
            'input[name*="name"]': profile.get("full_name", ""),
            'input[name*="email"]': profile.get("email", ""),
            'input[name*="phone"]': profile.get("phone", ""),
        }

        for selector, value in fields.items():
            try:
                field = page.locator(selector)
                if await field.count() > 0 and value:
                    await field.first.fill(value)
            except Exception:
                pass

        if resume_path:
            file_input = page.locator('input[type="file"]')
            if await file_input.count() > 0:
                try:
                    await file_input.first.set_input_files(resume_path)
                except Exception:
                    pass

        screenshot = await page.screenshot()
        return ApplyResult(
            success=False,
            platform="workday",
            error="Workday requires manual completion (assisted mode)",
            screenshot=screenshot,
        )

    except Exception as e:
        logger.error(f"Workday apply failed: {e}", exc_info=True)
        screenshot = await page.screenshot() if page else None
        return ApplyResult(success=False, platform="workday", error=str(e), screenshot=screenshot)