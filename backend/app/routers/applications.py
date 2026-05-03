from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, rate_limiter
from app.models import Application, Credential, JobListing, Profile, Resume, User
from app.schemas import ApplicationResponse, ApplicationStatusUpdate, ApplyRequest
from app.services.apply_service import apply_to_job

router = APIRouter(prefix="/applications", tags=["applications"])


def _profile_to_dict(profile: Profile | None, user: User) -> dict:
    if not profile:
        return {"full_name": user.full_name, "email": user.email, "phone": user.phone or "", "location": user.location or ""}
    return {
        "full_name": user.full_name,
        "email": user.email,
        "phone": user.phone or "",
        "location": user.location or "",
        "first_name": user.full_name.split()[0] if user.full_name else "",
        "last_name": " ".join(user.full_name.split()[1:]) if user.full_name and len(user.full_name.split()) > 1 else "",
        "headline": profile.headline or "",
        "summary": profile.summary or "",
        "skills": profile.skills or {},
        "experience": profile.experience or {},
        "education": profile.education or {},
        "linkedin_url": "",
    }


@router.post("/apply/{job_listing_id}", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def apply_to_job_endpoint(
    job_listing_id: uuid.UUID,
    body: ApplyRequest = ApplyRequest(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Rate limit check
    await rate_limiter.check(user.id)

    # Get job listing
    result = await db.execute(
        select(JobListing).where(JobListing.id == job_listing_id, JobListing.user_id == user.id)
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job listing not found")

    # Check if already applied
    existing = await db.execute(
        select(Application).where(
            Application.user_id == user.id,
            Application.job_listing_id == job_listing_id,
            Application.status.in_(["pending", "submitted"]),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already applied to this job")

    # Get credentials
    cred_result = await db.execute(
        select(Credential).where(
            Credential.user_id == user.id,
            Credential.platform == listing.platform,
            Credential.is_active == True,
        )
    )
    credential = cred_result.scalar_one_or_none()
    if not credential:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"No active {listing.platform} credentials found")

    # Get profile
    prof_result = await db.execute(select(Profile).where(Profile.user_id == user.id))
    profile = prof_result.scalar_one_or_none()
    profile_dict = _profile_to_dict(profile, user)

    # Get resume
    resume_path = None
    resume_id = body.resume_id
    if resume_id:
        res_result = await db.execute(select(Resume).where(Resume.id == resume_id, Resume.user_id == user.id))
        resume = res_result.scalar_one_or_none()
        if resume:
            resume_path = resume.file_path
    else:
        # Use default resume
        res_result = await db.execute(select(Resume).where(Resume.user_id == user.id, Resume.is_default == True))
        resume = res_result.scalar_one_or_none()
        if resume:
            resume_path = resume.file_path
            resume_id = resume.id

    if not resume_path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No resume found. Upload one first.")

    # Create application record
    application = Application(
        user_id=user.id,
        job_listing_id=job_listing_id,
        resume_id=resume_id,
        status="pending",
    )
    db.add(application)
    listing.status = "applied"
    await db.commit()
    await db.refresh(application)

    # Run application
    try:
        success, error, screenshot_path, answers = await apply_to_job(
            apply_url=listing.apply_url or "",
            user_id=user.id,
            profile=profile_dict,
            platform=listing.platform,
            username=credential.username,
            encrypted_password=credential.encrypted_password,
            resume_path=resume_path,
            cover_letter=None,
        )
    except Exception as e:
        success = False
        error = str(e)
        screenshot_path = None
        answers = {}

    # Update application
    if success:
        application.status = "submitted"
        application.applied_at = datetime.now(timezone.utc)
        listing.status = "applied"
    else:
        if application.retry_count < 1:
            application.retry_count += 1
            application.error_message = error
            application.status = "pending"  # Will be retried
        else:
            application.status = "failed"
            application.error_message = error
            listing.status = "failed"

    application.screenshot_path = screenshot_path
    application.answers_used = answers
    await db.commit()
    await db.refresh(application)

    # Increment rate limiter
    await rate_limiter.increment(user.id)

    return application


@router.get("/", response_model=dict)
async def list_applications(
    status_filter: str | None = Query(None, alias="status"),
    platform: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Application).where(Application.user_id == user.id)
    count_q = select(func.count(Application.id)).where(Application.user_id == user.id)

    if status_filter:
        query = query.where(Application.status == status_filter)
        count_q = count_q.where(Application.status == status_filter)

    if platform:
        query = query.join(JobListing, Application.job_listing_id == JobListing.id).where(JobListing.platform == platform)
        count_q = count_q.join(JobListing, Application.job_listing_id == JobListing.id).where(JobListing.platform == platform)

    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    query = query.order_by(Application.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "items": [ApplicationResponse.model_validate(i) for i in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.put("/{application_id}/status", response_model=ApplicationResponse)
async def update_application_status(
    application_id: uuid.UUID,
    body: ApplicationStatusUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Application).where(Application.id == application_id, Application.user_id == user.id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    app.status = body.status
    await db.commit()
    await db.refresh(app)
    return app


@router.get("/{application_id}", response_model=ApplicationResponse)
async def get_application(
    application_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Application).where(Application.id == application_id, Application.user_id == user.id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    return app
