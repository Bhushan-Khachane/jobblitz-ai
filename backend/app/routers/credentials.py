from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Credential, User
from app.schemas import CredentialCreate, CredentialResponse, CredentialUpdate
from app.utils.encryption import encrypt
from app.services.apply_service import login_with_credentials
import tempfile
from datetime import datetime, timezone

router = APIRouter(prefix="/credentials", tags=["credentials"])


@router.get("/", response_model=list[CredentialResponse])
async def list_credentials(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Credential).where(Credential.user_id == user.id).order_by(Credential.created_at.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=CredentialResponse, status_code=status.HTTP_201_CREATED)
async def create_credential(
    body: CredentialCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Encrypt password first
    encrypted_pw = encrypt(body.password)

    # Test login before saving — give immediate feedback
    with tempfile.TemporaryDirectory() as tmpdir:
        login_ok, login_error = await login_with_credentials(
            platform=body.platform,
            username=body.username,
            encrypted_password=encrypted_pw,
            user_data_dir=tmpdir,
        )

    if not login_ok:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Login verification failed for {body.platform}: {login_error}. "
                   f"Please check your email and password and try again."
        )

    # Check for duplicate
    existing = await db.execute(
        select(Credential).where(
            Credential.user_id == user.id,
            Credential.platform == body.platform,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{body.platform} credentials already exist. Delete the existing one first."
        )

    cred = Credential(
        user_id=user.id,
        platform=body.platform,
        username=body.username,
        encrypted_password=encrypted_pw,
        last_login_at=datetime.now(timezone.utc),
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
        select(Credential).where(Credential.id == credential_id, Credential.user_id == user.id)
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
        select(Credential).where(Credential.id == credential_id, Credential.user_id == user.id)
    )
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")
    await db.delete(cred)
    await db.commit()


@router.post("/{credential_id}/test", status_code=status.HTTP_200_OK)
async def test_credential(
    credential_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Credential).where(Credential.id == credential_id, Credential.user_id == user.id)
    )
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")

    with tempfile.TemporaryDirectory() as tmpdir:
        login_ok, login_error = await login_with_credentials(
            platform=cred.platform,
            username=cred.username,
            encrypted_password=cred.encrypted_password,
            user_data_dir=tmpdir,
        )

    if login_ok:
        cred.last_login_at = datetime.now(timezone.utc)
        await db.commit()
        return {"status": "success", "message": f"{cred.platform} login verified successfully ✓"}
    else:
        return {"status": "failed", "message": f"Login failed: {login_error}"}
