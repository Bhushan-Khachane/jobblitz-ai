"""ATS Router — dispatches apply tasks to platform-specific handlers.

Detects which ATS platform a job URL belongs to and routes to the
appropriate handler. Falls back to LLM-powered generic form filling.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from playwright.async_api import Page

logger = logging.getLogger(__name__)


@dataclass
class ApplyResult:
    """Result of a job application attempt."""
    success: bool
    platform: str
    mode: str = "auto"  # "auto" or "assisted" (requires user completion)
    screenshot: bytes | None = None
    error: str | None = None
    answers_used: dict[str, str] | None = None


# Platform handler registry
ATS_HANDLERS: dict[str, Any] = {}


def _register_handler(pattern: str):
    """Decorator to register an ATS handler for a URL pattern."""
    def decorator(func):
        ATS_HANDLERS[pattern] = func
        return func
    return decorator


async def route_apply(page: Page, job: dict, profile: dict, resume_path: str | None = None) -> ApplyResult:
    """Detect the ATS platform from the job URL and dispatch to the handler.

    Args:
        page: A borrowed browser context page from the BrowserPool.
        job: Job listing dict with 'apply_url', 'platform', etc.
        profile: User profile dict with name, email, phone, etc.
        resume_path: Path to the user's resume file.

    Returns:
        ApplyResult indicating success/failure and details.
    """
    url = job.get("apply_url", "") or job.get("external_url", "") or ""

    # Try each registered handler
    for pattern, handler in ATS_HANDLERS.items():
        if pattern in url.lower():
            logger.info(f"Routing {url} to handler for {pattern}")
            try:
                return await handler(page, job, profile, resume_path)
            except Exception as e:
                logger.error(f"Handler for {pattern} failed: {e}", exc_info=True)
                return ApplyResult(success=False, platform=pattern, error=str(e))

    # No handler matched — use generic LLM-powered fallback
    logger.info(f"No ATS handler matched for {url}, using generic fallback")
    try:
        from app.services.platforms.generic import handle_generic_form
        return await handle_generic_form(page, job, profile, resume_path)
    except Exception as e:
        logger.error(f"Generic form handler failed: {e}", exc_info=True)
        return ApplyResult(success=False, platform="generic", error=str(e))


# ── Platform handler stubs ──────────────────────────────────────────────────────
# Full implementations will be in services/platforms/

try:
    from app.services.platforms.linkedin import handle_linkedin_easy_apply
    ATS_HANDLERS["linkedin.com/jobs"] = handle_linkedin_easy_apply
except ImportError:
    logger.debug("LinkedIn handler not available yet")

try:
    from app.services.platforms.naukri import handle_naukri_direct
    ATS_HANDLERS["naukri.com"] = handle_naukri_direct
except ImportError:
    logger.debug("Naukri handler not available yet")

try:
    from app.services.platforms.greenhouse import handle_greenhouse
    ATS_HANDLERS["greenhouse.io"] = handle_greenhouse
except ImportError:
    logger.debug("Greenhouse handler not available yet")

try:
    from app.services.platforms.lever import handle_lever
    ATS_HANDLERS["lever.co"] = handle_lever
except ImportError:
    logger.debug("Lever handler not available yet")

try:
    from app.services.platforms.workday import handle_workday
    ATS_HANDLERS["workday.com"] = handle_workday
    ATS_HANDLERS["myworkdayjobs.com"] = handle_workday
except ImportError:
    logger.debug("Workday handler not available yet")

try:
    from app.services.platforms.smartrecruit import handle_smartrecruiters
    ATS_HANDLERS["smartrecruiters.com"] = handle_smartrecruiters
except ImportError:
    logger.debug("SmartRecruiters handler not available yet")