from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, rate_limiter
from app.models import JobLead, JobScore, User
from app.schemas import JobScoreResponse, StandardRunResponse
from app.services.agent_dispatcher import dispatch_scoring

router = APIRouter(prefix="/scoring", tags=["scoring"])


@router.post("/run", response_model=StandardRunResponse, status_code=status.HTTP_202_ACCEPTED)
async def run_scoring(
    job_lead_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a screening/scoring run for a job lead via ADK orchestrator."""
    result = await db.execute(
        select(JobLead).where(JobLead.id == job_lead_id, JobLead.user_id == user.id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Job lead not found")

    adk_result = await dispatch_scoring(str(user.id), [str(job_lead_id)])
    run_id = adk_result.get("run_id")

    return {
        "run_id": run_id,
        "status": "queued",
        "events": [{"step": "scoring_queued", "job_lead_id": str(job_lead_id)}],
        "error": None,
    }


@router.get("/job-scores", response_model=list[dict])
async def list_job_scores(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select as sa_select
    result = await db.execute(
        sa_select(JobScore, JobLead)
        .join(JobLead, JobScore.job_lead_id == JobLead.id)
        .where(JobScore.user_id == user.id)
        .order_by(JobScore.scored_at.desc())
    )
    rows = result.all()
    out = []
    for s, lead in rows:
        out.append({
            "id": str(s.id),
            "job_lead_id": str(s.job_lead_id),
            "fit_score": s.fit_score,
            "must_have_match": s.must_have_match,
            "gap_notes": s.gap_notes,
            "decision": s.decision,
            "scored_at": s.scored_at.isoformat() if s.scored_at else None,
            "job_title": lead.title if lead else "Job Lead",
            "company": lead.company if lead else "",
            "location": lead.location if lead else "",
            "url": lead.url if lead else "",
            "description": lead.jd_text if lead else "",
        })
    return out
