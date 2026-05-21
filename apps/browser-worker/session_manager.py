"""
Manages per-user browser sessions with two login modes:
  1) cookie_import (DEFAULT) — JSON cookie upload, works everywhere
  2) handoff (LOCAL DEV ONLY) — headed Chrome window, requires display

Auto-detects environment and branches accordingly.
Always returns evidence-rich results on both success and failure.
"""

import asyncio
import json
import os
import tempfile
import uuid

from browser import (
    cookie_import_file,
    goto,
    handoff,
    resume,
    screenshot,
    snapshot,
    state_load,
    state_save,
    text,
    url,
)

# ── Environment Detection ────────────────────────────────────────────────────

IS_DOCKER = os.path.exists("/.dockerenv")
HAS_DISPLAY = bool(os.getenv("DISPLAY", ""))


def get_login_method() -> str:
    """Return preferred login method for current environment.
    Respects LOGIN_METHOD env var override; falls back to auto-detect.
    """
    env_method = os.getenv("LOGIN_METHOD", "").lower()
    if env_method in ("handoff", "cookie", "cookie_import"):
        return "handoff" if env_method == "handoff" else "cookie_import"
    if not IS_DOCKER and HAS_DISPLAY:
        return "handoff"
    return "cookie_import"


# ── Portal Configuration ─────────────────────────────────────────────────────

PORTAL_LOGIN_URLS = {
    "naukri": "https://www.naukri.com/nlogin/login",
    "linkedin": "https://www.linkedin.com/login",
    "indeed": "https://secure.indeed.com/account/login",
}

PORTAL_VERIFY_URLS = {
    "naukri": "https://www.naukri.com/mnjuser/homepage",
    "linkedin": "https://www.linkedin.com/feed/",
    "indeed": "https://www.indeed.com/",
}

VERIFY_SUCCESS_SIGNALS = {
    "naukri": ["mnjuser", "myjobs", "recommended-jobs", "homepage", "my-profile", "nlogin/user-login"],
    "linkedin": ["feed", "mynetwork", "jobs/collections", "notifications"],
    "indeed": ["resume", "applied-jobs", "myjobs"],
}

LOGIN_PAGE_SIGNALS = {
    "naukri": ["login", "sign in", "register free", "forgot password", "nlogin/login"],
    "linkedin": ["sign in", "join now", "forgot password"],
    "indeed": ["sign in", "create account", "forgot password"],
}

BLOCKED_SIGNALS = ["access denied", "you don't have permission", "blocked", "unauthorized"]


def _page_is_blocked(page_text: str) -> bool:
    if not page_text:
        return False
    page_lower = page_text.lower()
    return any(s in page_lower for s in BLOCKED_SIGNALS)


# ── Public API ───────────────────────────────────────────────────────────────


def create_session(user_id: str, portal: str) -> dict:
    session_id = str(uuid.uuid4())
    method = get_login_method()
    return {
        "session_id": session_id,
        "portal": portal,
        "status": "pending_login",
        "login_method": method,
        "manual_login_url": PORTAL_LOGIN_URLS.get(portal),
        "instruction": _build_instruction(portal, method),
    }


async def start_manual_login(user_id: str, portal: str, session_id: str) -> dict:
    """Entry point: auto-routes to handoff or cookie-import based on env."""
    method = get_login_method()
    if method == "handoff":
        return await _handoff_login(portal, session_id)
    return await _cookie_import_login(portal, session_id)


async def verify_session(session_id: str, portal: str) -> dict:
    """After user says they've logged in, verify the session.
    Returns evidence-rich dict with verified, url, screenshot, page text.
    """
    try:
        # If we were in handoff, resume headless control
        if get_login_method() == "handoff":
            resume()
            await asyncio.sleep(2)

        # Navigate to a page that only exists when logged in
        verify_url = PORTAL_VERIFY_URLS.get(portal)
        if verify_url:
            goto(verify_url)
            await asyncio.sleep(3)

        current_url = url().strip()
        page_text = text()
        page_excerpt = page_text[:500] if page_text else ""

        # Take screenshot regardless of outcome
        screenshot_path = f"/tmp/session_verify_{session_id}.png"
        screenshot(screenshot_path)

        signals = VERIFY_SUCCESS_SIGNALS.get(portal, [])
        login_signals = LOGIN_PAGE_SIGNALS.get(portal, [])

        # Check if the page is blocked by CDN/WAF before anything else
        if _page_is_blocked(page_text):
            return _evidence_dict(
                verified=False,
                url=current_url,
                screenshot=screenshot_path,
                excerpt=page_excerpt,
                reason="Access denied by portal (bot detection / IP blocked). Try again from a different network or use manual mode.",
            )

        # Check URL for authenticated signals
        url_has_signal = any(s in current_url for s in signals)

        # Check page text for login page signals (failure condition)
        page_lower = page_text.lower() if page_text else ""
        text_has_login = any(s in page_lower for s in login_signals)

        if url_has_signal and not text_has_login:
            _save_state(session_id, portal)
            return _evidence_dict(
                verified=True,
                url=current_url,
                screenshot=screenshot_path,
                excerpt=page_excerpt,
                reason=None,
            )

        if text_has_login:
            return _evidence_dict(
                verified=False,
                url=current_url,
                screenshot=screenshot_path,
                excerpt=page_excerpt,
                reason="Login page still detected. Please complete login and try again.",
            )

        # Ambiguous — not on login page but no clear authenticated signal
        # Accept cautiously if not on login page
        _save_state(session_id, portal)
        return _evidence_dict(
            verified=True,
            url=current_url,
            screenshot=screenshot_path,
            excerpt=page_excerpt,
            reason="Verified by absence of login page. No clear authenticated signal found.",
        )

    except Exception as e:
        return _evidence_dict(
            verified=False,
            url=None,
            screenshot=None,
            excerpt=None,
            reason=str(e),
        )


async def restore_session(session_id: str, portal: str) -> bool:
    """Restore a previously saved browser session (cookies + URL)."""
    try:
        state_load(_state_key(session_id, portal))
        await asyncio.sleep(1)
        goto(PORTAL_VERIFY_URLS.get(portal, "https://www.naukri.com"))
        await asyncio.sleep(2)
        current_url = url().strip()
        page_text = text()
        if _page_is_blocked(page_text):
            return False
        signals = VERIFY_SUCCESS_SIGNALS.get(portal, [])
        login_signals = LOGIN_PAGE_SIGNALS.get(portal, [])
        has_success = any(s in current_url for s in signals)
        has_login = any(s in page_text.lower() for s in login_signals)
        return has_success and not has_login
    except Exception:
        return False


async def import_cookies_from_json(
    cookies: list[dict], portal: str, session_id: str
) -> dict:
    """Accept cookies exported from user's local browser (EditThisCookie JSON).
    Writes to a temp file and imports via Playwright cookie import.
    Returns evidence-rich dict.
    """
    # Filter cookies to only those matching the target portal domain
    domain_whitelist = (".naukri.com", "naukri.com", ".linkedin.com", "linkedin.com",
                        ".indeed.com", "indeed.com")
    filtered = [c for c in cookies if isinstance(c, dict) and
                any(d in str(c.get("domain", "")).lower() for d in domain_whitelist)]

    if not filtered:
        return _evidence_dict(
            verified=False,
            url=None,
            screenshot=None,
            excerpt=None,
            reason="No cookies matched the target portal domain after filtering.",
        )

    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(filtered, f)
        cookie_file = f.name

    try:
        cookie_import_file(cookie_file)
        os.unlink(cookie_file)
    except Exception as e:
        try:
            os.unlink(cookie_file)
        except FileNotFoundError:
            pass
        return _evidence_dict(
            verified=False,
            url=None,
            screenshot=None,
            excerpt=None,
            reason=f"Cookie import failed: {e}",
        )

    # Verify by navigating to a post-login page
    return await verify_session(session_id, portal)


# ── Internal Helpers ─────────────────────────────────────────────────────────


def _state_key(session_id: str, portal: str) -> str:
    return f"user_{session_id}_{portal}"


def _save_state(session_id: str, portal: str) -> None:
    state_save(_state_key(session_id, portal))


def _evidence_dict(
    verified: bool,
    url: str | None,
    screenshot: str | None,
    excerpt: str | None,
    reason: str | None,
) -> dict:
    return {
        "verified": verified,
        "url": url,
        "screenshot_url": screenshot,
        "page_text_excerpt": excerpt,
        "reason": reason,
    }


async def _handoff_login(portal: str, session_id: str) -> dict:
    login_url = PORTAL_LOGIN_URLS[portal]
    goto(login_url)
    handoff(
        f"Please log in to {portal.title()} and click 'I have logged in' when done."
    )
    return {
        "session_id": session_id,
        "status": "awaiting_login",
        "portal": portal,
        "login_method": "handoff",
        "instruction": (
            f"A {portal.title()} login window has opened on your screen. "
            f"Log in with your credentials, then click 'I Have Logged In' below."
        ),
    }


async def _cookie_import_login(portal: str, session_id: str) -> dict:
    return {
        "session_id": session_id,
        "status": "awaiting_cookie_import",
        "portal": portal,
        "login_method": "cookie_import",
        "instruction": (
            f"Log in to {portal.title()} in your own browser, export cookies via "
            f"EditThisCookie, and paste the JSON below."
        ),
    }


def _build_instruction(portal: str, method: str) -> str:
    if method == "handoff":
        return (
            f"A {portal.title()} login window will open on your screen. "
            f"Log in with your credentials, then return here and click 'I Have Logged In'."
        )
    return (
        f"Log in to {portal.title()} in your own browser, export cookies via "
        f"EditThisCookie, and paste the JSON below."
    )
