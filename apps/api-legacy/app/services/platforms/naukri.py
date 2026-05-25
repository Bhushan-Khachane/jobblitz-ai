"""Naukri direct apply handler."""

from __future__ import annotations

import logging
import uuid

from playwright.async_api import Page

from app.services.ats_router import ApplyResult

logger = logging.getLogger(__name__)


APPLY_BUTTON_SELECTORS = [
    'button:has-text("Apply")',
    'button:has-text("Apply Now")',
    'button:has-text("Apply on Naukri")',
    'a:has-text("Apply")',
    'a:has-text("Apply Now")',
    'a:has-text("Apply on Naukri")',
    'button[data-type="apply"]',  # Naukri data attribute
    'a[data-type="apply"]',
    '.apply-button',
    '.apply-btn',
    '[class*="apply"]',
    '[id*="apply"]',
]

EXTERNAL_APPLY_INDICATORS = [
    "apply on company website",
    "apply on company",
    "external apply",
    "company website",
    "visit company",
]


async def handle_naukri_direct(
    page: Page,
    job: dict,
    profile: dict,
    resume_path: str | None = None,
    user_id: uuid.UUID | None = None,
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
        # Use domcontentloaded to avoid hanging on networkidle
        await page.goto(url, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(3000)

        # Wait for the page to be more stable
        try:
            await page.wait_for_load_state("load", timeout=15000)
        except Exception:
            pass

        # Check page title to detect blocked/login pages
        title = await page.title()
        logger.info(f"Naukri page title: {title}")

        # Take screenshot for debugging
        try:
            screenshot = await page.screenshot()
        except Exception:
            screenshot = None

        # Check if we're on a login page
        login_indicators = ["login", "sign in", "signin", "naukri.com/nlogin"]
        if any(ind in title.lower() for ind in login_indicators):
            return ApplyResult(
                success=False,
                platform="naukri",
                error="Login required — user is not authenticated on Naukri",
                screenshot=screenshot,
            )

        # Check for external apply indicators
        page_text = await page.locator("body").inner_text()
        page_text_lower = page_text.lower()
        for indicator in EXTERNAL_APPLY_INDICATORS:
            if indicator in page_text_lower:
                return ApplyResult(
                    success=False,
                    platform="naukri",
                    error=f"External apply — redirect to company site ({indicator})",
                    screenshot=screenshot,
                )

        # Try multiple selectors for the apply button
        apply_btn = None
        for selector in APPLY_BUTTON_SELECTORS:
            try:
                locator = page.locator(selector).first
                count = await locator.count()
                if count > 0:
                    # Verify it's visible
                    visible = await locator.is_visible()
                    if visible:
                        apply_btn = locator
                        logger.info(f"Found apply button with selector: {selector}")
                        break
            except Exception:
                continue

        if not apply_btn:
            logger.warning(f"No apply button found on {url}. Page text snippet: {page_text[:500]}")
            return ApplyResult(
                success=False,
                platform="naukri",
                error="No Apply button found",
                screenshot=screenshot,
            )

        # Click apply button
        await apply_btn.click()
        await page.wait_for_timeout(4000)

        # Check if a form appeared or if we got redirected to login
        new_title = await page.title()
        if any(ind in new_title.lower() for ind in login_indicators):
            return ApplyResult(
                success=False,
                platform="naukri",
                error="Login required after clicking apply",
                screenshot=screenshot,
            )

        # Check for success indicators (immediate apply, no form)
        success_texts = [
            "application submitted",
            "successfully applied",
            "applied successfully",
            "application sent",
        ]
        final_text = await page.locator("body").inner_text()
        final_text_lower = final_text.lower()

        for success_text in success_texts:
            if success_text in final_text_lower:
                return ApplyResult(
                    success=True,
                    platform="naukri",
                    screenshot=screenshot,
                )

        # If no immediate success, a form may have appeared — try to fill it
        from app.services.apply_service import fill_application_form
        fill_ok, answers, unanswered, fill_err = await fill_application_form(
            page, profile, resume_path, None, user_id, platform="naukri"
        )

        if not fill_ok:
            return ApplyResult(
                success=False,
                platform="naukri",
                error=f"Form fill error: {fill_err}",
                screenshot=screenshot,
            )

        # If there are unanswered questions, send to assisted mode so user can answer them
        if unanswered:
            return ApplyResult(
                success=True,
                platform="naukri",
                mode="assisted",
                screenshot=screenshot,
                answers_used={"answered": answers, "unanswered": unanswered},
            )

        # Re-check for success after filling the form
        final_text = await page.locator("body").inner_text()
        final_text_lower = final_text.lower()
        for success_text in success_texts:
            if success_text in final_text_lower:
                return ApplyResult(
                    success=True,
                    platform="naukri",
                    screenshot=screenshot,
                    answers_used={"answered": answers, "unanswered": unanswered},
                )

        # Try clicking submit again in case the form added a new submit button
        try:
            sub_btn = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Send"), .submit-button').first
            if await sub_btn.count() > 0 and await sub_btn.is_visible():
                await sub_btn.click()
                await page.wait_for_timeout(3000)
                final_text = await page.locator("body").inner_text()
                for success_text in success_texts:
                    if success_text in final_text.lower():
                        return ApplyResult(
                            success=True,
                            platform="naukri",
                            screenshot=screenshot,
                            answers_used={"answered": answers, "unanswered": unanswered},
                        )
        except Exception:
            pass

        # Default to assisted mode if we filled the form but can't confirm success
        return ApplyResult(
            success=True,
            platform="naukri",
            mode="assisted",
            screenshot=screenshot,
            answers_used={"answered": answers, "unanswered": unanswered},
        )

    except Exception as e:
        logger.error(f"Naukri apply failed: {e}", exc_info=True)
        try:
            screenshot = await page.screenshot()
        except Exception:
            screenshot = None
        return ApplyResult(success=False, platform="naukri", error=str(e), screenshot=screenshot)
