from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import JobSearch, User
from app.schemas import JobSearchCreate, JobSearchResponse, JobSearchUpdate
from arq import create_pool
from arq.connections import RedisSettings
from app.config import settings

router = APIRouter(prefix="/job-searches", tags=["job_searches"])


@router.get("/", response_model=list[JobSearchResponse])
async def list_searches(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(JobSearch).where(JobSearch.user_id == user.id).order_by(JobSearch.created_at.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=JobSearchResponse, status_code=status.HTTP_201_CREATED)
async def create_search(
    body: JobSearchCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    search = JobSearch(user_id=user.id, **body.model_dump())
    db.add(search)
    await db.commit()
    await db.refresh(search)
    return search


@router.get("/{search_id}", response_model=JobSearchResponse)
async def get_search(
    search_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JobSearch).where(JobSearch.id == search_id, JobSearch.user_id == user.id)
    )
    search = result.scalar_one_or_none()
    if not search:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job search not found")
    return search


@router.put("/{search_id}", response_model=JobSearchResponse)
async def update_search(
    search_id: uuid.UUID,
    body: JobSearchUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JobSearch).where(JobSearch.id == search_id, JobSearch.user_id == user.id)
    )
    search = result.scalar_one_or_none()
    if not search:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job search not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(search, field, value)

    await db.commit()
    await db.refresh(search)
    return search


@router.delete("/{search_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_search(
    search_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JobSearch).where(JobSearch.id == search_id, JobSearch.user_id == user.id)
    )
    search = result.scalar_one_or_none()
    if not search:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job search not found")
    await db.delete(search)
    await db.commit()


@router.post("/{search_id}/run", status_code=status.HTTP_202_ACCEPTED)
async def run_search(
    search_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run a saved JobSearch via the full discovery workflow - returns immediately."""
    import httpx
    import os
    from app.models import Profile, Resume
    from app.services.agent_dispatcher import dispatch_workflow

    result = await db.execute(
        select(JobSearch).where(JobSearch.id == search_id, JobSearch.user_id == user.id)
    )
    search = result.scalar_one_or_none()
    if not search:
        raise HTTPException(status_code=404, detail="Job search not found")
    if not search.is_active:
        raise HTTPException(status_code=400, detail="Search is paused. Enable it first.")

    # Fetch user profile and resume
    prof_result = await db.execute(select(Profile).where(Profile.user_id == user.id))
    prof = prof_result.scalar_one_or_none()

    user_profile = {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "headline": prof.headline if prof else "",
        "skills": prof.skills if prof else [],
        "experience": prof.experience if prof else {},
        "summary": prof.summary if prof else "",
        "notice_period_days": prof.notice_period_days if prof else 30,
    }

    resume_text = ""
    res_result = await db.execute(
        select(Resume).where(Resume.user_id == user.id, Resume.is_default)
    )
    resume = res_result.scalar_one_or_none()
    if resume:
        resume_text = resume.parsed_text or ""

    adk_search_profile = {
        "id": str(search.id),
        "keywords": search.keywords,
        "location": search.location or "",
        "portal": search.platform,
        "years_experience": 2,
        "job_age_days": 7,
        "user_id": str(user.id),
    }

    # Pre-generate run_id and register it as "queued" via ADK before dispatching
    # so the frontend can start polling immediately
    adk_url = os.getenv("ADK_ORCHESTRATOR_URL", "http://adk-orchestrator:8001")
    pre_run_id = str(uuid.uuid4())
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.post(
                f"{adk_url}/agent/run/pre-register",
                json={"run_id": pre_run_id, "agent": "workflow"},
            )
    except Exception:
        pass  # non-fatal, we'll still dispatch

    # Fire-and-forget via FastAPI BackgroundTasks so the task survives response
    background_tasks.add_task(
        dispatch_workflow,
        str(user.id),
        search.platform,
        adk_search_profile,
        user_profile,
        resume_text,
        pre_run_id,
    )

    search.last_run_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "run_id": pre_run_id,
        "status": "queued",
        "message": f"Discovery workflow queued for search '{search.name}'",
    }


@router.post("/{search_id}/trigger", status_code=status.HTTP_202_ACCEPTED)
async def trigger_search(
    search_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JobSearch).where(JobSearch.id == search_id, JobSearch.user_id == user.id)
    )
    search = result.scalar_one_or_none()
    if not search:
        raise HTTPException(status_code=404, detail="Job search not found")
    if not search.is_active:
        raise HTTPException(status_code=400, detail="Search is paused. Enable it first.")

    # Dispatch the discovery task via ARQ with specific search filters
    redis_pool = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
    job = await redis_pool.enqueue_job(
        "discover_jobs",
        user_id=str(user.id),
        search_id=str(search_id),
    )
    await redis_pool.close()
    return {"message": f"Job discovery triggered for search '{search.name}'", "task_id": job.job_id if job else None}
