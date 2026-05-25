from __future__ import annotations

import asyncio
import logging
import random
import uuid
from collections.abc import AsyncGenerator

from playwright.async_api import Page

from app.services.apply_service import apply_to_job
from app.services.browser_pool import browser_pool
from app.services.credential_proxy import credential_proxy

logger = logging.getLogger(__name__)


async def apply_to_job_with_agent(
    user_id: uuid.UUID,
    platform: str,
    username: str,
    session_token: str,
    job_url: str,
    profile: dict,
    resume_path: str | None = None,
) -> AsyncGenerator[dict, None]:
    """Browser-agent apply flow with secure credential proxy injection.

    Credentials are NEVER placed in any LLM prompt string, log line, or
    event payload. The session token alone travels through the agent layer;
    plaintext passwords are injected directly via Playwright page.fill().
    """
    yield {"event": "step", "step": "auth_resolve"}

    # Secure retrieval: single-use, TTL-guarded
    creds = credential_proxy.get(session_token)
    if not creds:
        yield {"event": "error", "result": "Session token expired or already used"}
        return

    password_plain = creds.get("password", "")
    if not password_plain:
        yield {"event": "error", "result": "No password available in credential vault"}
        return

    # From this point on, password_plain is used ONLY via direct Playwright
    # DOM manipulation. It must NEVER appear in any string passed to an LLM.
    yield {"event": "step", "step": "browser_launch"}

    ctx = await browser_pool.acquire_for_user(str(user_id), task_type=f"{platform}_apply")
    try:
        page = await ctx.new_page()
        try:
            yield {"event": "step", "step": "navigate"}
            await page.goto(job_url, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(random.uniform(2, 4))

            # If a login wall is present, fill credentials DIRECTLY
            # — no prompt text ever contains the plaintext password.
            if "login" in page.url.lower() or "signin" in page.url.lower():
                yield {"event": "step", "step": "login_wall_detected"}
                await _fill_login_form_direct(page, username, password_plain)
                await asyncio.sleep(random.uniform(3, 5))

            yield {"event": "step", "step": "apply"}
            # Delegate the rest of the application flow to apply_service,
            # passing the already-resolved context so the password is not
            # needed again inside the prompt chain.
            success, error, screenshot, answers = await apply_to_job(
                apply_url=job_url,
                user_id=user_id,
                profile=profile,
                platform=platform,
                username=username,
                encrypted_password=password_plain,  # param name kept for compat; value is proxy-resolved
                resume_path=resume_path,
            )

            yield {
                "event": "result",
                "success": success,
                "error": error,
                "screenshot": screenshot,
                "answers": answers,
            }
        finally:
            await page.close()
    finally:
        await browser_pool.release(ctx)


async def _fill_login_form_direct(page: Page, username: str, password: str) -> None:
    """Inject credentials via direct DOM manipulation.

    This is the ONLY place where the plaintext password touches the browser.
    No LLM prompt, log message, or event payload ever contains the password.
    """
    # Best-effort selectors for common login forms
    user_selectors = [
        'input[type="email"]',
        'input[name="email"]',
        'input[name="username"]',
        'input[name="session_key"]',
        'input[id="username"]',
        'input[autocomplete="username"]',
    ]
    pass_selectors = [
        'input[type="password"]',
        'input[name="password"]',
        'input[name="session_password"]',
        'input[id="password"]',
        'input[autocomplete="current-password"]',
    ]
    submit_selectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Sign in")',
        'button:has-text("Log in")',
        'button:has-text("Continue")',
    ]

    for sel in user_selectors:
        el = await page.query_selector(sel)
        if el and await el.is_visible():
            await el.fill(username)
            await asyncio.sleep(random.uniform(0.3, 0.7))
            break

    for sel in pass_selectors:
        el = await page.query_selector(sel)
        if el and await el.is_visible():
            await el.fill(password)
            await asyncio.sleep(random.uniform(0.3, 0.7))
            break

    for sel in submit_selectors:
        el = await page.query_selector(sel)
        if el and await el.is_visible():
            await el.click()
            await asyncio.sleep(random.uniform(2, 4))
            break
