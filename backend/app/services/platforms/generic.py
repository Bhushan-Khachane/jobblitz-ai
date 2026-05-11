"""Generic form handler — LLM-powered fallback for unknown ATS platforms.

Uses the LLM client to detect and fill form fields when no platform-specific
handler is available.
"""

from __future__ import annotations

import logging

from playwright.async_api import Page

from app.services.ats_router import ApplyResult
from app.services.llm_client import get_llm_client

logger = logging.getLogger(__name__)


async def handle_generic_form(
    page: Page, job: dict, profile: dict, resume_path: str | None = None
) -> ApplyResult:
    """Apply to a job using LLM-assisted form detection and filling.

    This is the fallback handler for platforms without dedicated handlers.
    It uses the LLM to identify form fields and determine appropriate values.
    """
    url = job.get("apply_url", "") or job.get("external_url", "")

    try:
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        # Take a screenshot for LLM analysis
        screenshot = await page.screenshot()

        # Get the page HTML for field detection
        html_content = await page.content()

        # Use LLM to identify and fill form fields
        llm = get_llm_client()
        prompt = f"""Given this job application form HTML, identify all fillable input fields and their expected values.
Job title: {job.get('title', '')}
Company: {job.get('company', '')}
Candidate profile: {profile}

Return a JSON array of objects with "selector" and "value" keys for each field to fill.
Only include fields that can be auto-filled. Skip CAPTCHA, file uploads, and complex dropdowns.
"""
        fields = await llm.generate_structured(
            system="You are a form-filling assistant. Return ONLY a JSON array of field selectors and values.",
            user=prompt + "\n\nHTML (abbreviated):\n" + html_content[:5000],
        )

        # Fill identified fields
        if isinstance(fields, list):
            for field in fields:
                selector = field.get("selector", "")
                value = field.get("value", "")
                if selector and value:
                    try:
                        el = page.locator(selector)
                        if await el.count() > 0:
                            await el.first.fill(value)
                    except Exception as e:
                        logger.debug(f"Could not fill field {selector}: {e}")

        # Upload resume if available
        if resume_path:
            file_input = page.locator('input[type="file"]')
            if await file_input.count() > 0:
                try:
                    await file_input.first.set_input_files(resume_path)
                except Exception as e:
                    logger.debug(f"Could not upload resume: {e}")

        # Look for and click submit button
        submit_selectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Submit")',
            'button:has-text("Apply")',
            'button:has-text("Send")',
        ]

        submitted = False
        for selector in submit_selectors:
            btn = page.locator(selector)
            if await btn.count() > 0:
                await btn.first.click()
                await page.wait_for_timeout(3000)
                submitted = True
                break

        screenshot = await page.screenshot()
        if submitted:
            return ApplyResult(success=True, platform="generic", screenshot=screenshot)
        else:
            return ApplyResult(
                success=False,
                platform="generic",
                error="Could not find submit button",
                screenshot=screenshot,
            )

    except Exception as e:
        logger.error(f"Generic form handler failed: {e}", exc_info=True)
        try:
            screenshot = await page.screenshot()
        except Exception:
            screenshot = None
        return ApplyResult(success=False, platform="generic", error=str(e), screenshot=screenshot)