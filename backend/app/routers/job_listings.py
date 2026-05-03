from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import JobListing, User
from app.schemas import JobListingFilter, JobListingResponse

router = APIRouter(prefix="/job-listings", tags=["job_listings"])


@router.get("/", response_model=dict)
async def list_jobs(
    platform: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    company: str | None = None,
    keyword: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(JobListing).where(JobListing.user_id == user.id)
    count_query = select(func.count(JobListing.id)).where(JobListing.user_id == user.id)

    if platform:
        query = query.where(JobListing.platform == platform)
        count_query = count_query.where(JobListing.platform == platform)
    if status_filter:
        query = query.where(JobListing.status == status_filter)
        count_query = count_query.where(JobListing.status == status_filter)
    if company:
        query = query.where(JobListing.company.ilike(f"%{company}%"))
        count_query = count_query.where(JobListing.company.ilike(f"%{company}%"))
    if keyword:
        query = query.where(
            JobListing.title.ilike(f"%{keyword}%") | JobListing.description.ilike(f"%{keyword}%")
        )
        count_query = count_query.where(
            JobListing.title.ilike(f"%{keyword}%") | JobListing.description.ilike(f"%{keyword}%")
        )

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(JobListing.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "items": [JobListingResponse.model_validate(i) for i in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/{listing_id}", response_model=JobListingResponse)
async def get_job(
    listing_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JobListing).where(JobListing.id == listing_id, JobListing.user_id == user.id)
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job listing not found")
    return listing
