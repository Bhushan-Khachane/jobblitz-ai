from __future__ import annotations

import uuid

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_current_user_or_service
from app.models import (
    ApplicationPlan,
    ApplicationRun,
    ApplicationStepEvent,
    ApprovalRequest,
    JobLead,
    User,
)
from app.schemas import (
    ApplicationPlanResponse,
    ApplicationRunResponse,
    ApplicationStepEventResponse,
    ApprovalRequestResponse,
    StandardRunResponse,
)
from app.services.agent_dispatcher import dispatch_apply, get_run_status
from app.services.rate_enforcer import check_apply_rate, increment_apply_count

router = APIRouter(prefix="/application-runs", tags=["applications-v2"])


@router.post("/plan", response_model=StandardRunResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_application_plan(
    body: dict = Body(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create an application plan for a job lead and queue it."""
    job_lead_id = body.get("job_lead_id")
    if not job_lead_id:
        raise HTTPException(status_code=400, detail="job_lead_id required")
    try:
        job_lead_id = uuid.UUID(str(job_lead_id))
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid job_lead_id")

    result = await db.execute(
        select(JobLead).where(JobLead.id == job_lead_id, JobLead.user_id == user.id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Job lead not found")

    # Create plan
    plan = ApplicationPlan(
        user_id=user.id,
        job_lead_id=job_lead_id,
        fields={"job": {"url": lead.url, "title": lead.title, "company": lead.company}, "user_profile": {}},
        requires_approval=True,
    )
    db.add(plan)
    await db.flush()

    # Create run
    run = ApplicationRun(
        user_id=user.id,
        job_lead_id=job_lead_id,
        plan_id=plan.id,
        status="pending_approval",
    )
    db.add(run)
    await db.commit()

    return {
        "run_id": str(run.id),
        "status": "pending_approval",
        "events": [{"step": "plan_created", "plan_id": str(plan.id), "run_id": str(run.id)}],
        "error": None,
    }


@router.post("/{run_id}/approve", response_model=StandardRunResponse)
async def approve_application_run(
    run_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApplicationRun).where(ApplicationRun.id == run_id, ApplicationRun.user_id == user.id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Application run not found")

    run.status = "queued"
    await db.commit()

    return {
        "run_id": str(run_id),
        "status": run.status,
        "events": [{"step": "approved", "run_id": str(run_id)}],
        "error": None,
    }


@router.post("/{run_id}/apply", response_model=StandardRunResponse)
async def execute_application(
    run_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApplicationRun).where(ApplicationRun.id == run_id, ApplicationRun.user_id == user.id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Application run not found")

    # Rate limiting
    portal = "naukri"  # TODO: derive from job_lead
    rate = await check_apply_rate(str(user.id), portal)
    if not rate["allowed"]:
        raise HTTPException(status_code=429, detail=rate["reason"])

    run.status = "running"
    await db.commit()

    # Build plan payload for ADK
    plan_result = await db.execute(
        select(ApplicationPlan).where(ApplicationPlan.id == run.plan_id)
    )
    plan = plan_result.scalar_one_or_none()
    plan_payload = plan.fields if plan else {}

    # Dispatch ADK apply agent, passing backend run_id so step events align
    adk_result = await dispatch_apply(str(user.id), str(run.plan_id) if run.plan_id else "", plan_payload, str(run.id))
    await increment_apply_count(str(user.id), portal)

    # ADK returns queued immediately; actual result comes async via step-events
    run.status = "running"
    await db.commit()

    return {
        "run_id": str(run_id),
        "status": run.status,
        "events": [{"step": "apply_dispatched", "adk_run_id": adk_result.get("run_id")}],
        "error": run.error_message,
    }


@router.post("/{run_id}/verify", response_model=StandardRunResponse)
async def verify_application(
    run_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApplicationRun).where(ApplicationRun.id == run_id, ApplicationRun.user_id == user.id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Application run not found")

    # TODO: enqueue ADK verification agent
    return {
        "run_id": str(run_id),
        "status": "running",
        "events": [{"step": "verify_started", "run_id": str(run_id)}],
        "error": None,
    }


@router.get("/{run_id}/timeline", response_model=list[ApplicationStepEventResponse])
async def get_application_timeline(
    run_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApplicationRun).where(ApplicationRun.id == run_id, ApplicationRun.user_id == user.id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Application run not found")

    events_result = await db.execute(
        select(ApplicationStepEvent)
        .where(ApplicationStepEvent.run_id == run_id)
        .order_by(ApplicationStepEvent.created_at.asc())
    )
    return events_result.scalars().all()


@router.post("/{run_id}/step-events", response_model=ApplicationStepEventResponse, status_code=status.HTTP_201_CREATED)
async def create_step_event(
    run_id: uuid.UUID,
    event: dict = Body(...),
    user: User = Depends(get_current_user_or_service),
    db: AsyncSession = Depends(get_db),
):
    """ADK orchestrator posts step events here. Accepts user JWT or internal API key."""
    from app.dependencies import _SystemUser
    if isinstance(user, _SystemUser):
        # Internal service call — run_id from path, no user.id in DB writes
        pass

    result = await db.execute(
        select(ApplicationRun).where(ApplicationRun.id == run_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Application run not found")

    db_event = ApplicationStepEvent(
        run_id=run_id,
        step_name=event.get("step_name", ""),
        tool_name=event.get("tool_name", ""),
        tool_args=event.get("tool_args") or {},
        tool_output=event.get("tool_output", ""),
        success=event.get("success", False),
        dry_run=event.get("dry_run", False),
        planned_action=event.get("planned_action"),
        error_message=event.get("error_message", ""),
        screenshot_url=event.get("screenshot_url", ""),
        diff_text=event.get("diff_text", ""),
    )
    db.add(db_event)
    await db.commit()
    await db.refresh(db_event)
    return db_event


@router.get("/{run_id}/adk-status")
async def get_adk_run_status(
    run_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Proxy to ADK orchestrator for live run status."""
    result = await db.execute(
        select(ApplicationRun).where(ApplicationRun.id == run_id, ApplicationRun.user_id == user.id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Application run not found")

    status_data = await get_run_status(str(run_id))
    return status_data
