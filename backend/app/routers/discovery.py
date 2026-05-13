from __future__ import annotations

import hashlib
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, rate_limiter
from app.models import JobLead, JobSearchProfile, JobScore, User
from app.schemas import JobLeadResponse, JobSearchProfileCreate, JobSearchProfileResponse, StandardRunResponse
from app.services.agent_dispatcher import dispatch_discovery
from app.services.rate_enforcer import get_rate_status

router = APIRouter(prefix="/discovery", tags=["discovery"])


@router.post("/run", response_model=StandardRunResponse, status_code=status.HTTP_202_ACCEPTED)
async def run_discovery(
    search_profile_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a discovery run for a search profile via ADK orchestrator."""
    result = await db.execute(
        select(JobSearchProfile).where(
            JobSearchProfile.id == search_profile_id,
            JobSearchProfile.user_id == user.id,
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Search profile not found")

    # Dispatch to ADK orchestrator
    search_profile = {
        "id": str(search_profile_id),
        "keywords": profile.keywords,
        "location": (profile.locations or [""])[0] if profile.locations else "",
        "portal": profile.portals[0] if profile.portals else "naukri",
        "years_experience": profile.years_experience or 2,
        "job_age_days": profile.job_age_days or 7,
        "user_id": str(user.id),
    }

    adk_result = await dispatch_discovery(str(user.id), search_profile["portal"], search_profile)
    run_id = adk_result.get("run_id")

    return {
        "run_id": run_id,
        "status": "queued",
        "events": [{"step": "discovery_queued", "profile_id": str(search_profile_id)}],
        "error": None,
    }


@router.post("/job-leads/bulk", response_model=dict)
async def bulk_create_job_leads(
    body: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bulk insert job leads with deduplication by normalized hash."""
    leads = body.get("leads", [])
    portal = body.get("portal", "naukri")
    inserted = 0
    duplicates = 0

    for lead in leads:
        # Build normalized hash for dedup
        title = (lead.get("title") or "").strip().lower()
        company = (lead.get("company") or "").strip().lower()
        url = (lead.get("url") or "").strip()
        hash_input = f"{title}|{company}|{url}"
        normalized_hash = hashlib.sha256(hash_input.encode()).hexdigest()

        # Check for existing
        result = await db.execute(
            select(JobLead).where(
                JobLead.normalized_hash == normalized_hash,
                JobLead.user_id == user.id,
            )
        )
        if result.scalar_one_or_none():
            duplicates += 1
            continue

        # Insert new lead
        db_lead = JobLead(
            user_id=user.id,
            portal=portal,
            title=lead.get("title") or "",
            company=lead.get("company") or "",
            location=lead.get("location") or "",
            url=url,
            jd_text=lead.get("jd_text") or "",
            experience=lead.get("experience") or "",
            salary=lead.get("salary") or "",
            normalized_hash=normalized_hash,
            raw_data=lead,
        )
        db.add(db_lead)
        inserted += 1

    await db.commit()

    return {
        "inserted": inserted,
        "duplicates": duplicates,
        "total": len(leads),
    }


@router.get("/job-leads", response_model=dict)
async def list_job_leads(
    portal: str | None = None,
    processed: bool | None = None,
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(JobLead).where(JobLead.user_id == user.id)
    count_q = select(func.count(JobLead.id)).where(JobLead.user_id == user.id)

    if portal:
        query = query.where(JobLead.portal == portal)
        count_q = count_q.where(JobLead.portal == portal)
    if processed is not None:
        query = query.where(JobLead.processed == processed)
        count_q = count_q.where(JobLead.processed == processed)
    if status:
        # Join with job_scores to filter by decision
        query = query.join(JobScore, JobScore.job_lead_id == JobLead.id)
        query = query.where(JobScore.decision == status)

    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    query = query.order_by(JobLead.discovered_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "items": [JobLeadResponse.model_validate(i) for i in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/rate-status")
async def discovery_rate_status(
    portal: str = "naukri",
    user: User = Depends(get_current_user),
):
    return await get_rate_status(str(user.id), portal)
