from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import BrowserSession, User, UserPortalAccount
from app.schemas import PortalSessionCreate, PortalSessionResponse, StandardRunResponse

router = APIRouter(prefix="/portal-sessions", tags=["portal-sessions"])


@router.post("/", response_model=PortalSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_portal_session(
    body: PortalSessionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new browser session for a portal. No credentials are stored."""
    session_id = str(uuid.uuid4())
    portal = body.portal

    # Create or update user_portal_account
    result = await db.execute(
        select(UserPortalAccount).where(
            UserPortalAccount.user_id == user.id,
            UserPortalAccount.portal == portal,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        account = UserPortalAccount(
            user_id=user.id,
            portal=portal,
            status="disconnected",
        )
        db.add(account)

    # Create browser session
    browser_session = BrowserSession(
        user_id=user.id,
        portal=portal,
        session_id=session_id,
        status="pending_login",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(browser_session)
    await db.commit()
    await db.refresh(browser_session)

    manual_login_url = {
        "naukri": "https://www.naukri.com/mnjuser/homepage",
        "linkedin": "https://www.linkedin.com/feed/",
    }.get(portal)

    # Determine login method from env (mirrors browser-worker logic)
    import os
    login_method = os.getenv("LOGIN_METHOD", "cookie").lower()

    return {
        "id": browser_session.id,
        "session_id": browser_session.session_id,
        "portal": portal,
        "status": browser_session.status,
        "manual_login_url": manual_login_url,
        "login_method": login_method,
        "created_at": browser_session.created_at,
    }


@router.post("/{session_id}/verify", response_model=StandardRunResponse)
async def verify_portal_session(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify that the user has manually logged in to the portal."""
    result = await db.execute(
        select(BrowserSession).where(
            BrowserSession.session_id == session_id,
            BrowserSession.user_id == user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # In a real implementation, this would call the browser-worker
    # to check if the session is authenticated. For now, accept manual confirmation.
    session.status = "active"
    session.last_verified_at = datetime.now(timezone.utc)

    # Update account status
    account_result = await db.execute(
        select(UserPortalAccount).where(
            UserPortalAccount.user_id == user.id,
            UserPortalAccount.portal == session.portal,
        )
    )
    account = account_result.scalar_one_or_none()
    if account:
        account.status = "connected"

    await db.commit()
    await db.refresh(session)

    return {
        "run_id": str(session.id),
        "status": session.status,
        "events": [{"step": "verify", "result": "confirmed"}],
        "error": None,
    }


@router.get("/{session_id}/status", response_model=PortalSessionResponse)
async def get_session_status(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BrowserSession).where(
            BrowserSession.session_id == session_id,
            BrowserSession.user_id == user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    manual_login_url = {
        "naukri": "https://www.naukri.com/mnjuser/homepage",
        "linkedin": "https://www.linkedin.com/feed/",
    }.get(session.portal)

    import os
    login_method = os.getenv("LOGIN_METHOD", "cookie").lower()

    return {
        "id": session.id,
        "session_id": session.session_id,
        "portal": session.portal,
        "status": session.status,
        "manual_login_url": manual_login_url,
        "login_method": login_method,
        "created_at": session.created_at,
    }


@router.post("/{session_id}/import-cookies", response_model=StandardRunResponse)
async def import_cookies(
    session_id: str,
    payload: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept cookies from user's local browser and import into browser-worker session."""
    import os

    import httpx

    result = await db.execute(
        select(BrowserSession).where(
            BrowserSession.session_id == session_id,
            BrowserSession.user_id == user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    portal = payload.get("portal", session.portal)
    cookies = payload.get("cookies", [])

    browser_worker_url = os.getenv("BROWSER_WORKER_URL", "http://browser-worker:8002")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{browser_worker_url}/session/import-cookies",
                json={
                    "cookies": cookies,
                    "portal": portal,
                    "session_id": session_id,
                },
            )
            bw_result = resp.json().get("result", {})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Browser-worker error: {e}")

    if bw_result.get("verified"):
        session.status = "active"
        session.last_verified_at = datetime.now(timezone.utc)

        account_result = await db.execute(
            select(UserPortalAccount).where(
                UserPortalAccount.user_id == user.id,
                UserPortalAccount.portal == portal,
            )
        )
        account = account_result.scalar_one_or_none()
        if not account:
            account = UserPortalAccount(
                user_id=user.id,
                portal=portal,
                status="connected",
            )
            db.add(account)
        else:
            account.status = "connected"

        await db.commit()
        await db.refresh(session)
        return {
            "run_id": str(session.id),
            "status": session.status,
            "events": [{"step": "cookie_import", "result": "verified", "url": bw_result.get("url")}],
            "error": None,
        }

    return {
        "run_id": str(session.id),
        "status": session.status,
        "events": [{"step": "cookie_import", "result": "failed", "reason": bw_result.get("reason")}],
        "error": bw_result.get("reason"),
    }


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portal_session(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BrowserSession).where(
            BrowserSession.session_id == session_id,
            BrowserSession.user_id == user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    await db.delete(session)
    await db.commit()
    return None


@router.get("/check-expired")
async def check_expired_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return browser sessions that are active but have not been verified in 4+ hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=4)
    result = await db.execute(
        select(BrowserSession).where(
            BrowserSession.status == "active",
            BrowserSession.last_verified_at < cutoff,
        )
    )
    expired = result.scalars().all()

    # Mark them as expired
    for session in expired:
        session.status = "expired"
        # Update account status
        account_result = await db.execute(
            select(UserPortalAccount).where(
                UserPortalAccount.user_id == session.user_id,
                UserPortalAccount.portal == session.portal,
            )
        )
        account = account_result.scalar_one_or_none()
        if account:
            account.status = "requires_relogin"

    await db.commit()

    return {
        "expired_sessions": [
            {
                "user_id": str(s.user_id),
                "portal": s.portal,
                "session_id": s.session_id,
                "last_verified_at": s.last_verified_at.isoformat() if s.last_verified_at else None,
            }
            for s in expired
        ]
    }
