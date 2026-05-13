"""
Manages per-user browser sessions with two login modes:
  1) handoff    — headed Chrome window (local dev with display)
  2) cookie_import — JSON cookie upload (Docker / cloud / headless)

Auto-detects environment and branches accordingly.
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
    # Docker / CI / cloud — default to cookie import (works everywhere)
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
    "naukri": ["mnjuser", "myjobs", "recommended-jobs", "my-profile", "homepage"],
    "linkedin": ["feed", "mynetwork", "jobs/collections", "in/"],
    "indeed": ["resume", "applied-jobs", "myjobs"],
}


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
    For handoff mode: resume headless control from headed window.
    For cookie_import mode: verify by navigating to a logged-in-only page.
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
        signals = VERIFY_SUCCESS_SIGNALS.get(portal, [])

        if any(s in current_url for s in signals):
            _save_state(session_id, portal)
            screenshot(f"/tmp/session_verified_{session_id}.png")
            return {
                "verified": True,
                "session_id": session_id,
                "url": current_url,
                "screenshot": f"/tmp/session_verified_{session_id}.png",
            }

        # Check page text for login indicators
        page_text = text()
        if "sign in" in page_text.lower() or "log in" in page_text.lower():
            return {
                "verified": False,
                "reason": "Still showing login page. Please complete login and try again.",
                "url": current_url,
            }

        # URL is unclear but not login page — accept it
        _save_state(session_id, portal)
        return {
            "verified": True,
            "session_id": session_id,
            "url": current_url,
            "note": "Verified by absence of login page.",
        }

    except Exception as e:
        return {"verified": False, "reason": str(e)}


async def restore_session(session_id: str, portal: str) -> bool:
    """Restore a previously saved browser session (cookies + URL)."""
    try:
        state_load(f"user_{session_id}_{portal}")
        await asyncio.sleep(1)
        goto(PORTAL_VERIFY_URLS.get(portal, "https://www.naukri.com"))
        await asyncio.sleep(2)
        current_url = url().strip()
        signals = VERIFY_SUCCESS_SIGNALS.get(portal, [])
        return any(s in current_url for s in signals)
    except Exception:
        return False


async def import_cookies_from_json(
    cookies: list[dict], portal: str, session_id: str
) -> dict:
    """Accept cookies exported from user's local browser (EditThisCookie JSON).
    Writes to a temp file and imports via gstack browse cookie-import.
    """
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(cookies, f)
        cookie_file = f.name

    try:
        cookie_import_file(cookie_file)
        os.unlink(cookie_file)

        # Verify by navigating to a post-login page
        verify_url = PORTAL_VERIFY_URLS.get(portal)
        if verify_url:
            goto(verify_url)
            await asyncio.sleep(2)

        current_url = url().strip()
        signals = VERIFY_SUCCESS_SIGNALS.get(portal, [])
        verified = any(s in current_url for s in signals)

        if verified:
            _save_state(session_id, portal)
            screenshot(f"/tmp/session_verified_{session_id}.png")
            return {
                "verified": True,
                "session_id": session_id,
                "url": current_url,
                "screenshot": f"/tmp/session_verified_{session_id}.png",
            }

        # Check page text
        page_text = text()
        if "sign in" in page_text.lower() or "log in" in page_text.lower():
            return {
                "verified": False,
                "reason": "Login page still detected after cookie import. Cookies may be expired or portal-specific.",
                "url": current_url,
            }

        # Accept if not on login page
        _save_state(session_id, portal)
        return {
            "verified": True,
            "session_id": session_id,
            "url": current_url,
            "note": "Verified by absence of login page after cookie import.",
        }

    except Exception as e:
        try:
            os.unlink(cookie_file)
        except FileNotFoundError:
            pass
        return {"verified": False, "reason": str(e)}


async def notify_session_expired(user_id: str, portal: str):
    """Send a WhatsApp notification when a session expires."""
    import httpx

    backend_api = os.getenv("BACKEND_API_URL", "http://backend:8000")
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3001")

    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{backend_api}/api/v1/notifications/whatsapp",
                json={
                    "user_id": user_id,
                    "template": "session_expired",
                    "params": {
                        "portal": portal,
                        "action_url": f"{frontend_url}/portals/connect/{portal}",
                        "message": (
                            f"Your {portal.title()} session has expired on JobBlitzz. "
                            f"Please log in again to resume job applications."
                        ),
                    },
                },
                timeout=10.0,
            )
    except Exception as e:
        print(f"[WhatsApp notification failed] {e}")


# ── Internal Helpers ─────────────────────────────────────────────────────────


def _save_state(session_id: str, portal: str) -> None:
    state_save(f"user_{session_id}_{portal}")


async def _handoff_login(portal: str, session_id: str) -> dict:
    login_url = PORTAL_LOGIN_URLS[portal]
    goto(login_url)
    handoff(
        f"Please log in to {portal.title()} and click 'I have logged in' when done."
    )
    return {
        "session_id": session_id,
        "status": "awaiting_manual_login",
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
            f"EditThisCookie (or similar), and paste the JSON below."
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
