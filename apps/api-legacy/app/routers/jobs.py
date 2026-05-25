"""Job recommendations API router.

Endpoints:
- POST /jobs/discover — triggers discovery pipeline
- GET /jobs/recommendations — paginated scored jobs
- GET /jobs/recommendations/{job_id} — job detail
- POST /jobs/recommendations/{job_id}/apply — enqueue application
- GET /jobs/profile/summary — parsed candidate profile
- DELETE /jobs/recommendations/{job_id} — dismiss job
"""

from __future__ import annotations

import uuid
from datetime import datetime

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import JobRecommendation, User
from app.services.profile_parser import parse_candidate_profile

router = APIRouter(prefix="/jobs", tags=["jobs"])


# ── Schemas (inline for brevity) ───────────────────────────────────────────────

class JobRecommendationResponse(BaseModel):
    id: uuid.UUID
    job_id: str
    company: str | None
    role: str | None
    location: str | None
    job_type: str | None
    experience_required: str | None
    salary_estimate: str | None
    match_score: float
    match_score_pct: int
    priority_tier: str | None
    skill_breakdown: dict | None
    apply_link: str | None
    source_portal: str | None
    discovered_at: datetime
    status: str

    model_config = {"from_attributes": True}


class CandidateProfileResponse(BaseModel):
    headline: str
    summary: str
    core_skills: list[str]
    experience_years: float
    preferred_locations: list[str]
    certifications: list[str]
    salary_min_lpa: float | None
    salary_max_lpa: float | None

    model_config = {"from_attributes": True}


# ── Endpoints ────────────────────────────────────────────────────────────────────

@router.post("/discover", status_code=status.HTTP_202_ACCEPTED)
async def trigger_discovery(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger the discovery + scoring pipeline for the current user."""
    try:
        redis_pool = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
        try:
            await redis_pool.enqueue_job("run_discovery_scoring", user_id=str(user.id))
        finally:
            await redis_pool.close()
        return {"task_id": f"discover:{user.id}", "estimated_seconds": 120}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to enqueue discovery: {e}")


@router.get("/recommendations", response_model=list[JobRecommendationResponse])
async def list_recommendations(
    tier: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort: str = Query("match_score"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Paginated job recommendations for the current user."""
    stmt = select(JobRecommendation).where(
        JobRecommendation.user_id == user.id,
        JobRecommendation.status == "discovered",
    )
    if tier:
        stmt = stmt.where(JobRecommendation.priority_tier == tier.upper())
    if sort == "match_score":
        stmt = stmt.order_by(desc(JobRecommendation.match_score))
    elif sort == "salary":
        stmt = stmt.order_by(desc(JobRecommendation.salary_estimate))
    elif sort == "posted":
        stmt = stmt.order_by(desc(JobRecommendation.discovered_at))
    else:
        stmt = stmt.order_by(desc(JobRecommendation.match_score))

    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/recommendations/{job_id}", response_model=JobRecommendationResponse)
async def get_recommendation(
    job_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full job recommendation detail."""
    result = await db.execute(
        select(JobRecommendation).where(
            JobRecommendation.user_id == user.id,
            JobRecommendation.job_id == job_id,
        )
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Job recommendation not found")
    return rec


@router.post("/recommendations/{job_id}/apply")
async def apply_to_job(
    job_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enqueue a job application."""
    result = await db.execute(
        select(JobRecommendation).where(
            JobRecommendation.user_id == user.id,
            JobRecommendation.job_id == job_id,
        )
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Job recommendation not found")

    rec.status = "queued"
    rec.applied_at = datetime.now()
    await db.commit()

    return {"queued": True, "position": 1}


@router.get("/profile/summary", response_model=CandidateProfileResponse)
async def get_profile_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return parsed CandidateProfile for the current user."""
    profile = await parse_candidate_profile(str(user.id), db)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return CandidateProfileResponse(
        headline=profile.headline,
        summary=profile.summary,
        core_skills=profile.core_skills,
        experience_years=profile.experience_years,
        preferred_locations=profile.preferred_locations,
        certifications=profile.certifications,
        salary_min_lpa=profile.salary_min_lpa,
        salary_max_lpa=profile.salary_max_lpa,
    )


@router.delete("/recommendations/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def dismiss_recommendation(
    job_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dismiss a job recommendation."""
    result = await db.execute(
        select(JobRecommendation).where(
            JobRecommendation.user_id == user.id,
            JobRecommendation.job_id == job_id,
        )
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Job recommendation not found")
    rec.status = "dismissed"
    await db.commit()
