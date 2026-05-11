"""Login sessions API router.

Manages Neko cloud browser sessions for users to log into job portals.
JobBlitz never receives user passwords — only session cookies are captured.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.models import User
from app.services.neko_manager import neko_manager

router = APIRouter(prefix="/login-sessions", tags=["login"])


@router.post("/")
async def create_session(
    platform: str,
    user: User = Depends(get_current_user),
):
    """Create a Neko cloud browser session for a platform.

    Returns the stream URL for the frontend to embed as an iframe.
    The container auto-destructs after 10 minutes.
    """
    if platform not in ("linkedin", "naukri"):
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")

    try:
        session = await neko_manager.create_session(str(user.id), platform)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")

    return {
        "stream_url": session.stream_url,
        "token": session.token,
        "container_id": session.container_id,
        "platform": platform,
        "expires_at": session.expires_at.isoformat(),
    }


@router.get("/{platform}")
async def get_session_status(
    platform: str,
    user: User = Depends(get_current_user),
):
    """Get the status of an active login session for a platform."""
    # In a full implementation, we'd look up the active session from DB
    raise HTTPException(status_code=404, detail="No active session found")


@router.delete("/{platform}")
async def destroy_session(
    platform: str,
    container_id: str,
    user: User = Depends(get_current_user),
):
    """Destroy a Neko session and save cookies to the credential store."""
    try:
        await neko_manager.extract_and_store_cookies(container_id, str(user.id), platform)
    except Exception as e:
        # Still try to destroy the container even if cookie extraction fails
        await neko_manager.destroy_session(container_id)
        raise HTTPException(status_code=500, detail=f"Failed to save cookies: {str(e)}")

    return {"message": "Session destroyed and cookies saved", "platform": platform}


@router.post("/{platform}/verify")
async def verify_login(
    platform: str,
    container_id: str,
    user: User = Depends(get_current_user),
):
    """Check if the user has successfully logged in to the platform."""
    status = await neko_manager.check_login_status(container_id, platform)

    if status == "success":
        # Automatically extract and store cookies
        await neko_manager.extract_and_store_cookies(container_id, str(user.id), platform)
        return {"status": "success", "message": "Login confirmed and cookies saved"}
    elif status == "expired":
        return {"status": "expired", "message": "Session has expired"}
    else:
        return {"status": "pending", "message": "Login not yet detected"}