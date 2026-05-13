from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
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

router = APIRouter(prefix="/applications", tags=["applications-v2"])


@router.post("/plan", response_model=StandardRunResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_application_plan(
    job_lead_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JobLead).where(JobLead.id == job_lead_id, JobLead.user_id == user.id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Job lead not found")

    run_id = str(uuid.uuid4())
    # TODO: enqueue ADK planner agent
    return {
        "run_id": run_id,
        "status": "queued",
        "events": [{"step": "plan_queued", "job_lead_id": str(job_lead_id)}],
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

    # TODO: enqueue ADK apply agent
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

    # Dispatch ADK apply agent
    adk_result = await dispatch_apply(str(user.id), str(run.plan_id) if run.plan_id else "")
    await increment_apply_count(str(user.id), portal)

    return {
        "run_id": str(run_id),
        "status": run.status,
        "events": [{"step": "apply_dispatched", "adk_run_id": adk_result.get("run_id")}],
        "error": None,
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
