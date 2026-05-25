"""
Assigns a sticky residential proxy session per user.
Each user always exits via the same IP — looks like a consistent person.
Only used when browser extension is NOT connected (server-side fallback).
"""
import hashlib
import logging

from app.config import settings

logger = logging.getLogger(__name__)


def get_user_proxy(user_id: str) -> dict | None:
    """
    Returns Playwright proxy config for this user.
    Returns None if PROXY_URL is not configured.
    """
    proxy_url = getattr(settings, "PROXY_RESIDENTIAL_URL", None) or getattr(settings, "PROXY_URL", None)
    if not proxy_url:
        return None

    # Create deterministic session ID from user_id (same user = same IP)
    session_id = f"jb{hashlib.md5(str(user_id).encode()).hexdigest()[:8]}"

    # BrightData format: user-SESSION:pass@host:port
    if "brd.superproxy.io" in proxy_url or "brightdata" in proxy_url:
        user = settings.PROXY_RESIDENTIAL_USER if hasattr(settings, "PROXY_RESIDENTIAL_USER") else ""
        pw   = settings.PROXY_RESIDENTIAL_PASS if hasattr(settings, "PROXY_RESIDENTIAL_PASS") else ""
        host = "brd.superproxy.io:22225"
        return {"server": f"http://{user}-session-{session_id}:{pw}@{host}"}

    # Generic proxy URL (user replaces with their provider)
    return {"server": proxy_url}
