from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import BrowserSession, User, UserPortalAccount
from app.schemas import (
    PortalSessionCreate,
    PortalSessionListResponse,
    PortalSessionResponse,
    PortalVerifyResponse,
)

router = APIRouter(prefix="/portal-sessions", tags=["portal-sessions"])

BROWSER_WORKER_URL = os.getenv("BROWSER_WORKER_URL", "http://browser-worker:8002")
DEFAULT_LOGIN_METHOD = os.getenv("LOGIN_METHOD", "cookie").lower()

# ── Helpers ───────────────────────────────────────────────────────────────────


def _portal_login_url(portal: str) -> str | None:
    return {
        "naukri": "https://www.naukri.com/nlogin/login",
        "linkedin": "https://www.linkedin.com/login",
        "indeed": "https://secure.indeed.com/account/login",
    }.get(portal)


def _serialize_session(session: BrowserSession) -> dict:
    """Convert BrowserSession ORM object to PortalSessionResponse dict."""
    return {
        "id": session.id,
        "session_id": session.session_id,
        "portal": session.portal,
        "status": session.status,
        "manual_login_url": _portal_login_url(session.portal),
        "login_method": session.login_method or DEFAULT_LOGIN_METHOD,
        "verified": session.verified,
        "last_verified_at": session.last_verified_at,
        "expires_at": session.expires_at,
        "evidence": session.evidence_json,
        "error": session.evidence_json.get("reason") if session.evidence_json else None,
        "created_at": session.created_at,
    }


async def _call_browser_worker(path: str, payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(f"{BROWSER_WORKER_URL}{path}", json=payload)
        resp.raise_for_status()
        return resp.json()


# ── CRUD ──────────────────────────────────────────────────────────────────────


@router.get("/", response_model=PortalSessionListResponse)
async def list_portal_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all browser sessions for the current user, newest first."""
    result = await db.execute(
        select(BrowserSession)
        .where(BrowserSession.user_id == user.id)
        .order_by(desc(BrowserSession.created_at))
    )
    sessions = result.scalars().all()
    return {"sessions": [_serialize_session(s) for s in sessions]}


@router.post("/", response_model=PortalSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_portal_session(
    body: PortalSessionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new browser session for a portal. No credentials are stored."""
    session_id = str(uuid.uuid4())
    portal = body.portal
    login_method = DEFAULT_LOGIN_METHOD

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
        login_method=login_method,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(browser_session)
    await db.commit()
    await db.refresh(browser_session)

    return _serialize_session(browser_session)


@router.post("/{session_id}/start-login", response_model=PortalVerifyResponse)
async def start_login(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start the login flow. For handoff mode this opens a visible browser.
    For cookie mode this returns instructions."""
    result = await db.execute(
        select(BrowserSession).where(
            BrowserSession.session_id == session_id,
            BrowserSession.user_id == user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    login_method = session.login_method or DEFAULT_LOGIN_METHOD

    if login_method == "handoff":
        # Ask browser-worker to start handoff
        try:
            bw_resp = await _call_browser_worker(
                "/sessions/start-login",
                {
                    "user_id": str(user.id),
                    "portal": session.portal,
                    "session_id": session_id,
                },
            )
            bw_result = bw_resp.get("result", {})
            session.status = "awaiting_login"
            await db.commit()
            return PortalVerifyResponse(
                verified=False,
                reason=None,
                url=None,
                screenshot_url=None,
                page_text_excerpt=bw_result.get("instruction"),
                status=session.status,
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Browser-worker error: {e}")

    # Cookie import mode — just return instructions
    session.status = "awaiting_login"
    await db.commit()
    return PortalVerifyResponse(
        verified=False,
        reason=None,
        url=None,
        screenshot_url=None,
        page_text_excerpt=(
            f"Log in to {session.portal.title()} in your own browser, "
            f"export cookies via EditThisCookie, and paste the JSON below."
        ),
        status=session.status,
    )


@router.post("/{session_id}/import-cookies", response_model=PortalVerifyResponse)
async def import_cookies(
    session_id: str,
    payload: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept cookies from user's local browser and import into browser-worker session.
    Returns structured evidence on both success and failure."""
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

    if not cookies or not isinstance(cookies, list):
        raise HTTPException(status_code=400, detail="cookies must be a non-empty list")

    # Validate cookie shape
    for i, c in enumerate(cookies):
        if not isinstance(c, dict) or "name" not in c or "value" not in c:
            raise HTTPException(status_code=400, detail=f"Cookie at index {i} missing name/value")

    try:
        bw_resp = await _call_browser_worker(
            "/session/import-cookies",
            {
                "cookies": cookies,
                "portal": portal,
                "session_id": session_id,
            },
        )
        bw_result = bw_resp.get("result", {})
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Browser-worker returned {e.response.status_code}: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Browser-worker error: {e}")

    # Build evidence
    evidence = {
        "url": bw_result.get("url"),
        "screenshot_url": bw_result.get("screenshot_url"),
        "page_text_excerpt": bw_result.get("page_text_excerpt"),
        "reason": bw_result.get("reason"),
    }
    session.evidence_json = evidence

    if bw_result.get("verified"):
        session.status = "active"
        session.verified = True
        session.last_verified_at = datetime.now(timezone.utc)

        # Update account status
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
        return PortalVerifyResponse(
            verified=True,
            reason=None,
            url=bw_result.get("url"),
            screenshot_url=bw_result.get("screenshot_url"),
            page_text_excerpt=bw_result.get("page_text_excerpt"),
            status=session.status,
        )

    # Failed — keep status as pending_login so user can retry
    session.status = "pending_login"
    session.verified = False
    await db.commit()
    return PortalVerifyResponse(
        verified=False,
        reason=bw_result.get("reason"),
        url=bw_result.get("url"),
        screenshot_url=bw_result.get("screenshot_url"),
        page_text_excerpt=bw_result.get("page_text_excerpt"),
        status=session.status,
    )


@router.post("/{session_id}/verify", response_model=PortalVerifyResponse)
async def verify_portal_session(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify that the user has manually logged in to the portal.
    Calls the browser-worker to check real authentication state."""
    result = await db.execute(
        select(BrowserSession).where(
            BrowserSession.session_id == session_id,
            BrowserSession.user_id == user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        bw_resp = await _call_browser_worker(
            "/sessions/verify",
            {"session_id": session_id, "portal": session.portal},
        )
        bw_result = bw_resp.get("result", {})
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Browser-worker returned {e.response.status_code}: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Browser-worker error: {e}")

    # Build evidence
    evidence = {
        "url": bw_result.get("url"),
        "screenshot_url": bw_result.get("screenshot_url"),
        "page_text_excerpt": bw_result.get("page_text_excerpt"),
        "reason": bw_result.get("reason"),
    }
    session.evidence_json = evidence

    if bw_result.get("verified"):
        session.status = "active"
        session.verified = True
        session.last_verified_at = datetime.now(timezone.utc)

        account_result = await db.execute(
            select(UserPortalAccount).where(
                UserPortalAccount.user_id == user.id,
                UserPortalAccount.portal == session.portal,
            )
        )
        account = account_result.scalar_one_or_none()
        if not account:
            account = UserPortalAccount(
                user_id=user.id,
                portal=session.portal,
                status="connected",
            )
            db.add(account)
        else:
            account.status = "connected"

        await db.commit()
        await db.refresh(session)
        return PortalVerifyResponse(
            verified=True,
            reason=None,
            url=bw_result.get("url"),
            screenshot_url=bw_result.get("screenshot_url"),
            page_text_excerpt=bw_result.get("page_text_excerpt"),
            status=session.status,
        )

    session.status = "pending_login"
    session.verified = False
    await db.commit()
    return PortalVerifyResponse(
        verified=False,
        reason=bw_result.get("reason"),
        url=bw_result.get("url"),
        screenshot_url=bw_result.get("screenshot_url"),
        page_text_excerpt=bw_result.get("page_text_excerpt"),
        status=session.status,
    )


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

    return _serialize_session(session)


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

    # Mark portal account disconnected
    account_result = await db.execute(
        select(UserPortalAccount).where(
            UserPortalAccount.user_id == user.id,
            UserPortalAccount.portal == session.portal,
        )
    )
    account = account_result.scalar_one_or_none()
    if account:
        account.status = "disconnected"

    await db.delete(session)
    await db.commit()
    return None


@router.get("/check-expired")
async def check_expired_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return browser sessions that are active but have expired or not been verified in 4+ hours."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=4)

    result = await db.execute(
        select(BrowserSession).where(
            BrowserSession.user_id == user.id,
            BrowserSession.status == "active",
            (
                (BrowserSession.last_verified_at < cutoff)
                | (BrowserSession.expires_at < now)
            ),
        )
    )
    expired = result.scalars().all()

    for session in expired:
        session.status = "expired"
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
                "expires_at": s.expires_at.isoformat() if s.expires_at else None,
            }
            for s in expired
        ]
    }
