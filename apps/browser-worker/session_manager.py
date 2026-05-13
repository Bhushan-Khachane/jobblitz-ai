"""
Manages per-user browser sessions.
One isolated Chromium context per user per portal.
Users log in manually inside their own session.
No passwords are ever stored in our DB.
Session state (cookies, tabs) lives in gstack's ~/.gstack/sessions/
"""

import uuid
from browser import goto, snapshot
from config import get_browse_bin

PORTAL_DOMAINS = {
    "naukri": ".naukri.com",
    "linkedin": ".linkedin.com",
    "indeed": ".indeed.com",
}

PORTAL_URLS = {
    "naukri": "https://www.naukri.com/mnjuser/homepage",
    "linkedin": "https://www.linkedin.com/feed/",
}


def create_session(user_id: str, portal: str) -> dict:
    session_id = str(uuid.uuid4())
    return {
        "session_id": session_id,
        "manual_login_url": PORTAL_URLS.get(portal),
        "status": "pending_login",
        "instruction": (
            f"Open {PORTAL_URLS.get(portal)} in your browser. "
            f"Log in manually. Then return here and click 'I have logged in'."
        )
    }


async def notify_session_expired(user_id: str, portal: str):
    """Send a WhatsApp notification when a session expires."""
    import httpx
    import os

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
                        )
                    }
                },
                timeout=10.0,
            )
    except Exception as e:
        print(f"[WhatsApp notification failed] {e}")


def verify_session(session_id: str, portal: str) -> dict:
    try:
        goto(PORTAL_URLS[portal])
        snap = snapshot(interactive=False)
        if "sign in" in snap.lower() or "login" in snap.lower():
            return {"verified": False, "reason": "Login page detected. Please log in manually first."}
        return {"verified": True, "session_id": session_id}
    except Exception as e:
        return {"verified": False, "reason": str(e)}
