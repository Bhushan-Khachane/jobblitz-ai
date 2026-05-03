from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Profile, User
from app.schemas import CoverLetterRequest, CoverLetterResponse
from app.services.ai_service import cover_letter_generate

router = APIRouter(prefix="/cover-letters", tags=["cover_letters"])


@router.post("/generate", response_model=CoverLetterResponse)
async def generate_cover_letter(
    body: CoverLetterRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Build candidate profile string
    result = await db.execute(select(Profile).where(Profile.user_id == user.id))
    profile = result.scalar_one_or_none()

    profile_parts = [f"Name: {user.full_name}"]
    if profile:
        if profile.headline:
            profile_parts.append(f"Headline: {profile.headline}")
        if profile.summary:
            profile_parts.append(f"Summary: {profile.summary}")
        if profile.skills:
            profile_parts.append(f"Skills: {profile.skills}")
        if profile.experience:
            profile_parts.append(f"Experience: {profile.experience}")
        if profile.education:
            profile_parts.append(f"Education: {profile.education}")

    candidate_profile = "\n".join(profile_parts)

    try:
        letter = await cover_letter_generate(
            job_description=body.job_description,
            company_name=body.company_name,
            candidate_profile=candidate_profile,
            job_title=body.job_title,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI service error: {str(e)}")

    return CoverLetterResponse(cover_letter=letter)
