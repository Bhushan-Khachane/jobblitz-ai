"""Login sessions API router.

Manages Neko cloud browser sessions for users to log into job portals.
JobBlitz never receives user passwords — only session cookies are captured.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.database import engine
from app.dependencies import get_current_user
from app.models import LoginSession, User
from app.services.neko_manager import neko_manager

router = APIRouter(prefix="/login-sessions", tags=["login"])

_async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


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

    # Persist session to database
    async with _async_session() as db:
        login_session = LoginSession(
            user_id=user.id,
            platform=platform,
            container_id=session.container_id,
            iframe_url=session.stream_url,
            token=session.token,
            status="active",
            expires_at=session.expires_at,
        )
        db.add(login_session)
        await db.commit()

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
    async with _async_session() as db:
        result = await db.execute(
            select(LoginSession).where(
                LoginSession.user_id == user.id,
                LoginSession.platform == platform,
                LoginSession.status.in_(["creating", "active"]),
            ).order_by(LoginSession.created_at.desc())
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="No active session found")

        # Check actual login status via Neko CDP — pass cdp_url derived from iframe_url + port
        status = await neko_manager.check_login_status(session.container_id, platform)

        if status == "success":
            session.status = "cookies_saved"
        elif status == "expired":
            session.status = "expired"

        await db.commit()

        return {
            "container_id": session.container_id,
            "stream_url": session.iframe_url,
            "token": session.token,
            "status": session.status,
            "expires_at": session.expires_at.isoformat(),
        }


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
        # Container destruction is handled by extract_and_store_cookies's finally block
        raise HTTPException(status_code=500, detail=f"Failed to save cookies: {str(e)}")

    # Mark session as destroyed in DB
    async with _async_session() as db:
        result = await db.execute(
            select(LoginSession).where(
                LoginSession.container_id == container_id,
                LoginSession.user_id == user.id,
            )
        )
        session = result.scalar_one_or_none()
        if session:
            session.status = "cookies_saved"
            await db.commit()

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