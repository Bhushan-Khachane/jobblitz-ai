"""LinkedIn Easy Apply handler.

Handles the LinkedIn Easy Apply flow: click Easy Apply button,
iterate through form steps, fill known fields, upload resume, submit.
Max 10 steps before bailout.
"""

from __future__ import annotations

import logging
from typing import Any

from playwright.async_api import Page

from app.services.ats_router import ApplyResult

logger = logging.getLogger(__name__)


async def handle_linkedin_easy_apply(
    page: Page, job: dict, profile: dict, resume_path: str | None = None
) -> ApplyResult:
    """Apply to a LinkedIn job using Easy Apply flow."""
    url = job.get("apply_url", "") or job.get("external_url", "")

    try:
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        # Click Easy Apply button
        easy_apply = page.locator('[aria-label="Easy Apply"]')
        if await easy_apply.count() == 0:
            return ApplyResult(success=False, platform="linkedin", error="No Easy Apply button found")

        await easy_apply.first.click()
        await page.wait_for_selector(".jobs-easy-apply-modal", timeout=10000)

        # Iterate through form steps (max 10)
        for step in range(10):
            # Fill phone number if field exists
            phone_input = page.locator('input[name="phoneNumber"]')
            if await phone_input.count() > 0:
                await phone_input.first.fill(profile.get("phone", ""))

            # Upload resume if field exists
            upload_field = page.locator(".jobs-document-upload")
            if await upload_field.count() > 0 and resume_path:
                file_input = upload_field.locator('input[type="file"]')
                if await file_input.count() > 0:
                    await file_input.set_input_files(resume_path)

            # Answer screening questions if present
            question_section = page.locator(".jobs-easy-apply-form-section__grouping")
            if await question_section.count() > 0:
                await _answer_screening_questions(page, question_section, profile)

            # Check for submit button
            submit_btn = page.locator('[aria-label="Submit application"]')
            if await submit_btn.count() > 0:
                await submit_btn.first.click()
                await page.wait_for_timeout(2000)
                screenshot = await page.screenshot()
                return ApplyResult(success=True, platform="linkedin", screenshot=screenshot)

            # Click "Continue" to next step
            next_btn = page.locator('[aria-label="Continue to next step"]')
            if await next_btn.count() > 0:
                await next_btn.first.click()
                await page.wait_for_load_state("networkidle", timeout=5000)
            else:
                break

        return ApplyResult(success=False, platform="linkedin", error="Easy Apply flow incomplete")

    except Exception as e:
        logger.error(f"LinkedIn Easy Apply failed: {e}", exc_info=True)
        screenshot = await page.screenshot() if page else None
        return ApplyResult(success=False, platform="linkedin", error=str(e), screenshot=screenshot)


async def _answer_screening_questions(page: Page, section, profile: dict) -> None:
    """Attempt to answer screening questions using profile data."""
    # Handle radio buttons (Yes/No questions)
    radio_groups = section.locator(".jobs-easy-apply-form-section__grouping")
    count = await radio_groups.count()
    for i in range(count):
        group = radio_groups.nth(i)
        # Default to "Yes" for most questions unless we can determine otherwise
        yes_option = group.locator('input[value="Yes"]')
        if await yes_option.count() > 0:
            await yes_option.first.click()

    # Handle text input questions
    text_inputs = section.locator('input[type="text"]')
    for i in range(await text_inputs.count()):
        input_field = text_inputs.nth(i)
        placeholder = await input_field.get_attribute("placeholder") or ""
        label = await input_field.get_attribute("aria-label") or ""
        if "year" in placeholder.lower() or "year" in label.lower():
            await input_field.fill(str(profile.get("experience_years", "5")))