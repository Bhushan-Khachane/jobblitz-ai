"""Scheduled tasks for the ADK Orchestrator."""

import os
from datetime import datetime, timezone, timedelta

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from state.run_tracker import update_run_progress

scheduler = AsyncIOScheduler()

BACKEND_API = os.getenv("BACKEND_API_URL", "http://backend:8000")


async def notify_session_expired(user_id: str, portal: str):
    """Send WhatsApp notification when a session expires."""
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{BACKEND_API}/api/v1/notifications/whatsapp",
                json={
                    "user_id": user_id,
                    "template": "session_expired",
                    "params": {
                        "portal": portal,
                        "action_url": f"{os.getenv('FRONTEND_URL', 'http://localhost:3001')}/portals/connect/{portal}",
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


@scheduler.scheduled_job("interval", hours=6)
async def check_expired_sessions():
    """Check for expired browser sessions every 6 hours."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BACKEND_API}/api/v1/portal-sessions/check-expired",
                timeout=10.0,
            )
            expired = resp.json().get("expired_sessions", [])
            for session in expired:
                await notify_session_expired(session["user_id"], session["portal"])
    except Exception as e:
        print(f"[check_expired_sessions failed] {e}")


def start_scheduler():
    scheduler.start()
