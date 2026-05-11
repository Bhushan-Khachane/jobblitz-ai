from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
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
