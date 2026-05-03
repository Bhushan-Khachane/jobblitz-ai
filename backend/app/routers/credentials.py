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
    encrypted_pw = encrypt(body.password)
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
