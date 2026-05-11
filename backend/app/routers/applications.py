from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
import json as _json
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, rate_limiter
from app.models import Application, Credential, JobListing, Profile, Resume, User
from app.schemas import ApplicationResponse, ApplicationStatusUpdate, ApplyRequest
from arq import create_pool
from arq.connections import RedisSettings
from app.config import settings

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
        "skills": profile.skills or [],
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
    """Apply to a job listing. Creates an application record and dispatches a background task.

    For assisted mode users, the application is created with approval_status='pending_approval'.
    For auto mode users, the task is dispatched immediately.
    Returns the application record immediately — status updates happen asynchronously.
    """
    # Atomic rate limit check + increment
    await rate_limiter.check_and_increment(user.id)

    # Get job listing
    result = await db.execute(
        select(JobListing).where(JobListing.id == job_listing_id, JobListing.user_id == user.id)
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job listing not found")

    # Idempotency: check for existing application by key
    idempotency_key = f"apply:{user.id}:{job_listing_id}"
    existing = await db.execute(
        select(Application).where(Application.idempotency_key == idempotency_key)
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

    # Get resume
    resume_id = body.resume_id
    if not resume_id:
        res_result = await db.execute(select(Resume).where(Resume.user_id == user.id, Resume.is_default == True))
        resume = res_result.scalar_one_or_none()
        if resume:
            resume_id = resume.id

    if not resume_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No resume found. Upload one first.")

    # Determine application mode
    application_mode = getattr(user, "application_mode", "assisted") or "assisted"

    # Create application record
    if application_mode == "manual":
        # Manual mode: just create a record, user applies themselves
        application = Application(
            user_id=user.id,
            job_listing_id=job_listing_id,
            resume_id=resume_id,
            status="pending",
            approval_status=None,
            idempotency_key=idempotency_key,
        )
        db.add(application)
        listing.status = "applied"
        await db.commit()
        await db.refresh(application)
        return application

    if application_mode == "assisted":
        # Assisted mode: create with pending_approval, user must approve before apply
        application = Application(
            user_id=user.id,
            job_listing_id=job_listing_id,
            resume_id=resume_id,
            status="pending",
            approval_status="pending_approval",
            idempotency_key=idempotency_key,
        )
        db.add(application)
        listing.status = "discovered"  # Keep as discovered until approved
        await db.commit()
        await db.refresh(application)
        return application

    # Auto mode: dispatch the background task immediately
    application = Application(
        user_id=user.id,
        job_listing_id=job_listing_id,
        resume_id=resume_id,
        status="pending",
        approval_status="approved",
        idempotency_key=idempotency_key,
    )
    db.add(application)
    listing.status = "applied"
    await db.commit()
    await db.refresh(application)

    # Dispatch background task via ARQ
    redis_pool = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
    await redis_pool.enqueue_job(
        "auto_apply",
        user_id=str(user.id),
        job_listing_id=str(job_listing_id),
        resume_id=str(resume_id),
    )
    await redis_pool.close()

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


@router.get("/approval-queue", response_model=list[ApplicationResponse])
async def get_approval_queue(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all applications awaiting user approval (assisted mode)."""
    result = await db.execute(
        select(Application)
        .where(
            Application.user_id == user.id,
            Application.approval_status == "pending_approval",
        )
        .order_by(Application.created_at.desc())
    )
    return result.scalars().all()


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


@router.post("/{application_id}/approve")
async def approve_application(
    application_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve a pending application and dispatch the apply task."""
    result = await db.execute(
        select(Application).where(Application.id == application_id, Application.user_id == user.id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app.approval_status != "pending_approval":
        raise HTTPException(status_code=400, detail="Application is not pending approval")

    app.approval_status = "approved"
    app.status = "pending"
    await db.commit()

    # Dispatch the auto-apply task via ARQ
    redis_pool = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
    await redis_pool.enqueue_job(
        "auto_apply",
        user_id=str(user.id),
        job_listing_id=str(app.job_listing_id),
        resume_id=str(app.resume_id) if app.resume_id else None,
    )
    await redis_pool.close()

    return {"message": "Application approved and queued", "application_id": str(app.id)}


@router.post("/{application_id}/reject")
async def reject_application(
    application_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject a pending application (user decides not to apply)."""
    result = await db.execute(
        select(Application).where(Application.id == application_id, Application.user_id == user.id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app.approval_status != "pending_approval":
        raise HTTPException(status_code=400, detail="Application is not pending approval")

    app.approval_status = "rejected"
    app.status = "skipped"
    await db.commit()

    # Also mark the job listing
    listing_result = await db.execute(
        select(JobListing).where(JobListing.id == app.job_listing_id)
    )
    listing = listing_result.scalar_one_or_none()
    if listing:
        listing.status = "skipped"
        await db.commit()

    return {"message": "Application rejected", "application_id": str(app.id)}


@router.get("/{job_listing_id}/stream-apply")
async def stream_apply(
    job_listing_id: uuid.UUID,
    resume_id: uuid.UUID | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Stream a live apply attempt via Server-Sent Events.
    Frontend connects to this endpoint and receives real-time
    step-by-step progress from the browser agent.
    """
    # Get listing
    listing_result = await db.execute(
        select(JobListing).where(JobListing.id == job_listing_id, JobListing.user_id == user.id)
    )
    listing = listing_result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Job listing not found")

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
        raise HTTPException(status_code=400, detail=f"No active {listing.platform} credentials")

    # Get profile
    prof_result = await db.execute(select(Profile).where(Profile.user_id == user.id))
    profile = prof_result.scalar_one_or_none()
    profile_dict = _profile_to_dict(profile, user)

    # Get resume
    resume_path = None
    if resume_id:
        res_result = await db.execute(
            select(Resume).where(Resume.id == resume_id, Resume.user_id == user.id)
        )
        resume = res_result.scalar_one_or_none()
        if resume:
            resume_path = resume.file_path
    else:
        res_result = await db.execute(
            select(Resume).where(Resume.user_id == user.id, Resume.is_default == True)
        )
        resume = res_result.scalar_one_or_none()
        if resume:
            resume_path = resume.file_path

    async def event_stream():
        try:
            async for event in apply_to_job_with_agent(
                user_id=user.id,
                platform=listing.platform,
                username=credential.username,
                encrypted_password=credential.encrypted_password,
                job_url=listing.apply_url or "",
                profile=profile_dict,
                resume_path=resume_path,
            ):
                yield f"data: {_json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {_json.dumps({'event': 'error', 'result': str(e)})}\n\n"
        finally:
            yield "data: {\"event\": \"done\"}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
