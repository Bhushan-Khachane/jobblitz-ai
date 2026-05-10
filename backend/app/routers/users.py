from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Profile, User
from app.schemas import ProfileCreate, ProfileResponse, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return user


@router.put("/me", response_model=UserResponse)
async def update_me(
    body: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.phone is not None:
        user.phone = body.phone
    if body.location is not None:
        user.location = body.location
    if body.application_mode is not None:
        user.application_mode = body.application_mode
    if body.daily_apply_limit is not None:
        user.daily_apply_limit = body.daily_apply_limit
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/me/profile", response_model=ProfileResponse | None)
async def get_profile(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Profile).where(Profile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        return None
    return profile


@router.put("/me/profile", response_model=ProfileResponse, status_code=status.HTTP_200_OK)
async def upsert_profile(
    body: ProfileCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Profile).where(Profile.user_id == user.id))
    profile = result.scalar_one_or_none()

    data = body.model_dump(exclude_unset=True)

    if profile:
        for k, v in data.items():
            setattr(profile, k, v)
    else:
        profile = Profile(user_id=user.id, **data)
        db.add(profile)

    await db.commit()
    await db.refresh(profile)
    return profile
