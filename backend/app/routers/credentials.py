from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Credential, User
from app.schemas import CredentialCreate, CredentialResponse, CredentialUpdate
from app.utils.encryption import encrypt

router = APIRouter(prefix="/credentials", tags=["credentials"])


@router.get("/", response_model=list[CredentialResponse])
async def list_credentials(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Credential)
        .where(Credential.user_id == user.id)
        .order_by(Credential.created_at.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=CredentialResponse, status_code=status.HTTP_201_CREATED)
async def create_credential(
    body: CredentialCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    encrypted_pw = encrypt(body.password)

    # Check for duplicate platform credential
    existing = await db.execute(
        select(Credential).where(
            Credential.user_id == user.id,
            Credential.platform == body.platform,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{body.platform.capitalize()} credentials already exist. Remove the existing ones first.",
        )

    # Save credentials — login verification happens separately via /test endpoint
    # We do NOT block save on login test because:
    # 1. Login test via Playwright/browser-use takes 30-60 seconds
    # 2. HTTP requests time out before it completes
    # 3. Users can explicitly test via the Test button after saving
    cred = Credential(
        user_id=user.id,
        platform=body.platform,
        username=body.username,
        encrypted_password=encrypted_pw,
    )
    db.add(cred)
    await db.commit()
    await db.refresh(cred)
    return cred


@router.put("/{credential_id}", response_model=CredentialResponse)
async def update_credential(
    credential_id: uuid.UUID,
    body: CredentialUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Credential).where(
            Credential.id == credential_id,
            Credential.user_id == user.id,
        )
    )
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")

    if body.username is not None:
        cred.username = body.username
    if body.password is not None:
        cred.encrypted_password = encrypt(body.password)
    if body.is_active is not None:
        cred.is_active = body.is_active

    await db.commit()
    await db.refresh(cred)
    return cred


@router.delete("/{credential_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_credential(
    credential_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Credential).where(
            Credential.id == credential_id,
            Credential.user_id == user.id,
        )
    )
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")
    await db.delete(cred)
    await db.commit()


@router.post("/{credential_id}/test")
async def test_credential(
    credential_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Test saved credentials by running a quick browser login check.
    This is a long-running operation (30-60s) — call from frontend
    with a long timeout or trigger as a background task.
    """
    result = await db.execute(
        select(Credential).where(
            Credential.id == credential_id,
            Credential.user_id == user.id,
        )
    )
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")

    try:
        from app.services.neko_manager import neko_manager
        session = await neko_manager.create_session(str(user.id), cred.platform)
        return {
            "platform": cred.platform,
            "success": False,
            "message": "Credential testing is now handled via cloud browser login. Use /api/v1/login-sessions to create a session.",
            "stream_url": session.stream_url,
            "tested_at": datetime.now(timezone.utc).isoformat(),
            "deprecated": True,
            "new_endpoint": "/api/v1/login-sessions",
        }
    except Exception as e:
        return {
            "platform": cred.platform,
            "success": False,
            "message": f"Test failed with error: {str(e)[:300]}",
            "tested_at": datetime.now(timezone.utc).isoformat(),
        }
