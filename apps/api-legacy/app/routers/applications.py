from __future__ import annotations

import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
import json as _json
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_current_user_or_service, has_platform_access, rate_limiter
from app.models import Application, Credential, JobLead, JobListing, Profile, Resume, User
from app.schemas import ApplicationResponse, ApplicationStatusUpdate, ApplyRequest
from app.services.agent_service import apply_to_job_with_agent
from app.services.credential_proxy import credential_proxy
from app.utils.encryption import decrypt
from pydantic import BaseModel
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


_arq_pool = None


async def _get_arq_pool():
    global _arq_pool
    if _arq_pool is None:
        _arq_pool = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
    return _arq_pool


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

    # Verify user has access to the platform (credentials or active portal session)
    if not await has_platform_access(user.id, listing.platform, db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No active {listing.platform} credentials or portal session found",
        )

    # Get resume
    resume_id = body.resume_id
    if not resume_id:
        res_result = await db.execute(select(Resume).where(Resume.user_id == user.id, Resume.is_default))
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
    redis_pool = await _get_arq_pool()
    await redis_pool.enqueue_job(
        "auto_apply",
        user_id=str(user.id),
        job_listing_id=str(job_listing_id),
        resume_id=str(resume_id),
    )

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


@router.get("/me/approval-queue", response_model=list[ApplicationResponse])
async def get_approval_queue(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all applications awaiting user approval (assisted mode)."""
    result = await db.execute(
        select(Application, JobListing)
        .join(JobListing, Application.job_listing_id == JobListing.id)
        .where(
            Application.user_id == user.id,
            Application.approval_status == "pending_approval",
        )
        .order_by(Application.created_at.desc())
    )
    rows = result.all()
    out = []
    for app, listing in rows:
        out.append(ApplicationResponse(
            id=app.id,
            job_listing_id=app.job_listing_id,
            resume_id=app.resume_id,
            status=app.status,
            approval_status=app.approval_status,
            idempotency_key=app.idempotency_key,
            cover_letter=app.cover_letter,
            error_message=app.error_message,
            screenshot_path=app.screenshot_path,
            retry_count=app.retry_count,
            applied_at=app.applied_at,
            created_at=app.created_at,
            job_title=listing.title,
            company=listing.company,
            location=listing.location,
            apply_url=listing.apply_url,
            fit_score=listing.match_score,
            gap_notes=(listing.match_explanation or {}).get("gap_notes") if listing.match_explanation else None,
            portal=listing.platform,
            answers_used=app.answers_used,
        ))
    return out


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
    redis_pool = await _get_arq_pool()
    await redis_pool.enqueue_job(
        "auto_apply",
        user_id=str(user.id),
        job_listing_id=str(app.job_listing_id),
        resume_id=str(app.resume_id) if app.resume_id else None,
    )

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


class AnswerQuestionsRequest(BaseModel):
    answers: list[dict[str, str]]  # [{"question": "...", "answer": "..."}]


@router.post("/{application_id}/answer-questions", response_model=dict)
async def answer_questions(
    application_id: uuid.UUID,
    body: AnswerQuestionsRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save user-provided answers to QuestionAnswer memory and re-queue the application."""
    from app.models import QuestionAnswer
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    result = await db.execute(
        select(Application).where(Application.id == application_id, Application.user_id == user.id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # Validate answers shape
    for item in body.answers:
        if "question" not in item or "answer" not in item:
            raise HTTPException(status_code=400, detail="Each answer must have 'question' and 'answer' keys")

    # Save each answer to QuestionAnswer memory
    platform = ""
    listing_result = await db.execute(select(JobListing).where(JobListing.id == app.job_listing_id))
    listing = listing_result.scalar_one_or_none()
    if listing:
        platform = listing.platform or ""

    for item in body.answers:
        stmt = pg_insert(QuestionAnswer).values(
            user_id=user.id,
            question_text=item["question"],
            answer_text=item["answer"],
            platform=platform,
            usage_count=1,
        ).on_conflict_do_update(
            index_elements=["user_id", "question_text", "platform"],
            set_={"answer_text": item["answer"], "usage_count": QuestionAnswer.usage_count + 1},
        )
        await db.execute(stmt)

    # Merge new answers into the existing answers_used JSONB
    existing = app.answers_used or {}
    answered = existing.get("answered", {})
    unanswered = existing.get("unanswered", [])

    for item in body.answers:
        q = item["question"]
        answered[q] = item["answer"]
        if q in unanswered:
            unanswered.remove(q)

    app.answers_used = {"answered": answered, "unanswered": unanswered}
    app.approval_status = "approved"
    app.status = "pending"
    await db.commit()

    # Re-queue auto_apply so it retries with the new answers in memory
    redis_pool = await _get_arq_pool()
    await redis_pool.enqueue_job(
        "auto_apply",
        user_id=str(user.id),
        job_listing_id=str(app.job_listing_id),
        resume_id=str(app.resume_id) if app.resume_id else None,
    )

    return {
        "message": "Answers saved and application queued for retry",
        "application_id": str(app.id),
        "saved": len(body.answers),
    }


@router.post("/from-lead/{job_lead_id}", response_model=dict)
async def create_application_from_lead(
    job_lead_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create an application from a job lead.

    Finds or creates a JobListing from the JobLead, then creates an Application.
    Returns the application_id for use with mark-manual and generate-cover-letter.
    """
    from app.models import JobLead

    # Get the job lead
    lead_result = await db.execute(
        select(JobLead).where(JobLead.id == job_lead_id, JobLead.user_id == user.id)
    )
    lead = lead_result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Job lead not found")

    # Find or create a job listing
    listing_result = await db.execute(
        select(JobListing).where(
            JobListing.user_id == user.id,
            JobListing.external_job_id == lead.normalized_hash,
        )
    )
    listing = listing_result.scalar_one_or_none()
    if not listing:
        listing = JobListing(
            user_id=user.id,
            platform=lead.portal,
            external_job_id=lead.normalized_hash,
            title=lead.title,
            company=lead.company,
            location=lead.location,
            description=lead.jd_text or "",
            apply_url=lead.url,
            salary_info=getattr(lead, "salary", None) or "",
            status="discovered",
            match_score=0.5,
        )
        db.add(listing)
        await db.flush()

    # Check for existing application
    existing = await db.execute(
        select(Application).where(
            Application.user_id == user.id,
            Application.job_listing_id == listing.id,
        )
    )
    app = existing.scalar_one_or_none()
    if not app:
        # Get default resume
        res_result = await db.execute(
            select(Resume).where(Resume.user_id == user.id, Resume.is_default)
        )
        resume = res_result.scalar_one_or_none()

        app = Application(
            user_id=user.id,
            job_listing_id=listing.id,
            resume_id=resume.id if resume else None,
            status="pending",
            idempotency_key=f"apply:{user.id}:{listing.id}",
        )
        db.add(app)
        await db.flush()

    await db.commit()
    await db.refresh(app)

    return {
        "application_id": str(app.id),
        "job_listing_id": str(listing.id),
        "status": app.status,
    }


class QueueApprovalRequest(BaseModel):
    user_id: str
    job_lead: dict
    screening_result: dict
    search_profile_id: str | None = None


@router.post("/me/queue-approval")
async def queue_for_approval(
    body: QueueApprovalRequest,
    user: User = Depends(get_current_user_or_service),
    db: AsyncSession = Depends(get_db),
):
    """Called by ADK orchestrator to create an Application record pending user approval."""
    from app.dependencies import _SystemUser
    if not isinstance(user, _SystemUser):
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        user_uuid = uuid.UUID(body.user_id)
    except ValueError:
        return {"status": "error", "reason": "invalid user_id"}

    url = (body.job_lead.get("url") or "").strip()
    portal = body.job_lead.get("portal", "naukri")
    title = body.job_lead.get("title", "")
    company = body.job_lead.get("company", "")

    # 1) Find or create JobLead
    job_lead = None
    if url:
        result = await db.execute(
            select(JobLead).where(JobLead.url == url, JobLead.user_id == user_uuid)
        )
        job_lead = result.scalar_one_or_none()

    if not job_lead:
        job_lead = JobLead(
            user_id=user_uuid,
            portal=portal,
            title=title,
            company=company,
            location=body.job_lead.get("location"),
            url=url or None,
            jd_text=body.job_lead.get("jd_text") or body.job_lead.get("description") or "",
            raw_data=body.job_lead,
        )
        db.add(job_lead)
        await db.flush()

    # 2) Find or create JobListing from JobLead
    listing_result = await db.execute(
        select(JobListing).where(
            JobListing.user_id == user_uuid,
            JobListing.external_job_id == job_lead.normalized_hash,
        )
    )
    listing = listing_result.scalar_one_or_none()
    if not listing:
        listing = JobListing(
            user_id=user_uuid,
            platform=portal,
            external_job_id=job_lead.normalized_hash,
            title=title,
            company=company,
            location=body.job_lead.get("location"),
            description=body.job_lead.get("jd_text") or body.job_lead.get("description") or "",
            apply_url=url or None,
            salary_info=body.job_lead.get("salary", ""),
            status="discovered",
            match_score=body.screening_result.get("fit_score", 0) / 100.0,
        )
        db.add(listing)
        await db.flush()

    # 3) Idempotency key
    idempotency_key = f"apply:{user_uuid}:{listing.id}"
    existing_result = await db.execute(
        select(Application).where(Application.idempotency_key == idempotency_key)
    )
    existing_app = existing_result.scalar_one_or_none()
    if existing_app:
        return {"status": "already_queued", "application_id": str(existing_app.id)}

    # 4) Find default resume
    res_result = await db.execute(
        select(Resume).where(Resume.user_id == user_uuid, Resume.is_default)
    )
    resume = res_result.scalar_one_or_none()

    # 5) Create Application in pending_approval status
    app = Application(
        user_id=user_uuid,
        job_listing_id=listing.id,
        resume_id=resume.id if resume else None,
        status="pending",
        approval_status="pending_approval",
        idempotency_key=idempotency_key,
        answers_used={
            "screening": body.screening_result,
            "job_lead": body.job_lead,
        },
    )
    db.add(app)
    await db.commit()
    await db.refresh(app)

    return {"status": "queued", "application_id": str(app.id)}


@router.post("/{application_id}/generate-cover-letter")
async def generate_cover_letter(
    application_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a cover letter and screening answers for an application.

    Loads the application, job listing, and user profile, then calls the
    ADK orchestrator cover-letter task. Caches in Redis for 7 days.
    """
    import httpx
    # Load application with job listing
    result = await db.execute(
        select(Application)
        .where(Application.id == application_id, Application.user_id == user.id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    listing_result = await db.execute(
        select(JobListing).where(JobListing.id == app.job_listing_id)
    )
    listing = listing_result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Job listing not found")

    # Load profile
    prof_result = await db.execute(select(Profile).where(Profile.user_id == user.id))
    profile = prof_result.scalar_one_or_none()
    profile_dict = _profile_to_dict(profile, user)
    profile_dict["skills"] = profile.skills if profile else []
    profile_dict["headline"] = profile.headline if profile else ""
    profile_dict["summary"] = profile.summary if profile else ""
    profile_dict["experience"] = profile.experience if profile else {}
    profile_dict["notice_period_days"] = profile.notice_period_days if profile else 30

    job = {
        "title": listing.title,
        "company": listing.company,
        "location": listing.location,
        "description": listing.description or "",
        "url": listing.apply_url or "",
        "salary": listing.salary_info or "",
    }

    # Call ADK orchestrator
    adk_url = settings.ADK_ORCHESTRATOR_URL
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{adk_url}/tasks/cover-letter",
                json={
                    "user_id": str(user.id),
                    "job": job,
                    "profile": profile_dict,
                },
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Cover letter service error: {e}")

    # Cache in Redis
    try:
        from app.redis_client import get_redis
        r = get_redis()
        cache_key = f"cover_letter:{user.id}:{application_id}"
        await r.setex(cache_key, 60 * 60 * 24 * 7, _json.dumps(data))
    except Exception:
        pass

    return data


@router.post("/{application_id}/mark-manual")
async def mark_manual_apply(
    application_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark an application as manually applied by the user."""
    result = await db.execute(
        select(Application).where(Application.id == application_id, Application.user_id == user.id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    app.status = "submitted"
    await db.commit()
    await db.refresh(app)
    return {"status": "ok", "message": "Marked as manually applied"}


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
    if os.getenv("BROWSER_AGENT_ENABLED", "false").lower() != "true":
        raise HTTPException(
            status_code=501,
            detail="Browser-based auto-apply is not yet available. Use the approval queue instead.",
        )

    # Get listing
    listing_result = await db.execute(
        select(JobListing).where(JobListing.id == job_listing_id, JobListing.user_id == user.id)
    )
    listing = listing_result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Job listing not found")

    # Verify user has access to the platform (credentials or active portal session)
    if not await has_platform_access(user.id, listing.platform, db):
        raise HTTPException(
            status_code=400,
            detail=f"No active {listing.platform} credentials or portal session found",
        )

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
            select(Resume).where(Resume.user_id == user.id, Resume.is_default)
        )
        resume = res_result.scalar_one_or_none()
        if resume:
            resume_path = resume.file_path

    # Fetch active credential for the platform
    cred_result = await db.execute(
        select(Credential)
        .where(Credential.user_id == user.id, Credential.platform == listing.platform, Credential.is_active.is_(True))
        .order_by(Credential.updated_at.desc())
    )
    credential = cred_result.scalar_one_or_none()
    if not credential:
        raise HTTPException(
            status_code=400,
            detail=f"No active credentials found for {listing.platform}",
        )

    # Decrypt password and store in secure proxy — only the token travels forward
    password_plain = decrypt(credential.encrypted_password)
    session_token = await credential_proxy.put(
        user_id=str(user.id),
        platform=listing.platform,
        creds={"username": credential.username, "password": password_plain},
    )

    async def event_stream():
        try:
            async for event in apply_to_job_with_agent(
                user_id=user.id,
                platform=listing.platform,
                username=credential.username,
                session_token=session_token,
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
