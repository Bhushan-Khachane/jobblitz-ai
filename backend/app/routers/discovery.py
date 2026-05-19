from __future__ import annotations

import hashlib
import uuid

import os

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import JobLead, JobSearchProfile, JobScore, Profile, Resume, User
from app.schemas import JobLeadResponse, StandardRunResponse
from app.services.agent_dispatcher import dispatch_workflow
from app.services.velocity_governor import get_apply_stats

router = APIRouter(prefix="/discovery", tags=["discovery"])


@router.post("/run/direct", response_model=StandardRunResponse, status_code=status.HTTP_202_ACCEPTED)
async def run_discovery_direct(
    search_profile: dict = Body(..., embed=True),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Direct scrape — bypasses ADK orchestrator. Use when ADK is not deployed."""
    from app.services.scraper_service import scrape_naukri_jobs, scrape_linkedin_jobs
    import logging

    logger = logging.getLogger(__name__)
    keywords  = search_profile.get("keywords", "")
    location  = search_profile.get("location", "")
    portal    = search_profile.get("portal", "naukri")
    if not keywords:
        raise HTTPException(status_code=400, detail="keywords required")

    try:
        if portal == "naukri":
            leads = await scrape_naukri_jobs(keywords=keywords, location=location, max_results=25)
        elif portal == "linkedin":
            leads = await scrape_linkedin_jobs(keywords=keywords, location=location, max_results=25)
        else:
            leads = await scrape_naukri_jobs(keywords=keywords, location=location, max_results=25)
    except Exception as e:
        logger.error(f"Direct scrape error: {e}")
        raise HTTPException(status_code=500, detail=f"Scrape failed: {e}")

    inserted = 0
    for lead in leads:
        title   = (lead.get("title") or "").strip().lower()
        company = (lead.get("company") or "").strip().lower()
        url     = (lead.get("apply_url") or lead.get("url") or "").strip()
        norm    = hashlib.sha256(f"{title}|{company}|{url}".encode()).hexdigest()
        existing = await db.execute(
            select(JobLead).where(JobLead.normalized_hash == norm, JobLead.user_id == user.id)
        )
        if existing.scalar_one_or_none():
            continue
        db_lead = JobLead(
            user_id=user.id,
            portal=portal,
            title=lead.get("title") or "",
            company=lead.get("company") or "",
            location=lead.get("location") or "",
            url=url,
            jd_text=lead.get("description") or lead.get("jd_text") or "",
            experience=lead.get("experience") or "",
            salary=lead.get("salary_info") or lead.get("salary") or "",
            normalized_hash=norm,
            raw_data=lead,
        )
        db.add(db_lead)
        inserted += 1

    await db.commit()
    run_id = f"direct-{uuid.uuid4().hex[:8]}"
    return {
        "run_id": run_id,
        "status": "completed",
        "events": [{"step": "direct_scrape_complete", "inserted": inserted, "portal": portal}],
        "error": None,
    }


@router.post("/run", response_model=StandardRunResponse, status_code=status.HTTP_202_ACCEPTED)
async def run_discovery(
    search_profile: dict = Body(..., embed=True),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a discovery run from inline search criteria via ADK orchestrator."""
    # Use inline search criteria directly (frontend sends keywords, location, portal, etc.)
    keywords = search_profile.get("keywords", "")
    location = search_profile.get("location", "")
    portal = search_profile.get("portal", "naukri")
    years_experience = search_profile.get("years_experience", 2)
    job_age_days = search_profile.get("job_age_days", 7)

    if not keywords:
        raise HTTPException(status_code=400, detail="keywords required")

    # Auto-create a temporary search profile so the flow is stateful
    profile = JobSearchProfile(
        user_id=user.id,
        name=f"Auto: {keywords}",
        keywords=keywords,
        locations=[location] if location else None,
        portals=[portal],
        years_experience=years_experience,
        job_age_days=job_age_days,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)

    # Fetch user profile and resume for the workflow
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

    # Fetch resume text
    resume_text = ""
    res_result = await db.execute(
        select(Resume).where(Resume.user_id == user.id, Resume.is_default)
    )
    resume = res_result.scalar_one_or_none()
    if resume:
        resume_text = resume.parsed_text or ""

    # Dispatch full workflow to ADK orchestrator
    adk_search_profile = {
        "id": str(profile.id),
        "keywords": keywords,
        "location": location,
        "portal": portal,
        "years_experience": years_experience,
        "job_age_days": job_age_days,
        "user_id": str(user.id),
    }

    adk_result = await dispatch_workflow(
        str(user.id),
        portal,
        adk_search_profile,
        user_profile,
        resume_text,
    )
    run_id = adk_result.get("run_id")
    adk_error = adk_result.get("error")

    # If ADK is unreachable, fall back to direct scraping in-process
    if not run_id or adk_result.get("status") == "error":
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"ADK unreachable ({adk_error}) — falling back to direct scrape")

        from app.services.scraper_service import scrape_naukri_jobs, scrape_linkedin_jobs

        try:
            if portal == "naukri":
                leads = await scrape_naukri_jobs(
                    keywords=keywords,
                    location=location,
                    max_results=20,
                )
            elif portal == "linkedin":
                leads = await scrape_linkedin_jobs(
                    keywords=keywords,
                    location=location,
                    max_results=20,
                )
            else:
                leads = []

            inserted = 0
            for lead in leads:
                title   = (lead.get("title") or "").strip().lower()
                company = (lead.get("company") or "").strip().lower()
                url     = (lead.get("apply_url") or lead.get("url") or "").strip()
                norm    = hashlib.sha256(f"{title}|{company}|{url}".encode()).hexdigest()
                existing = await db.execute(
                    select(JobLead).where(JobLead.normalized_hash == norm, JobLead.user_id == user.id)
                )
                if existing.scalar_one_or_none():
                    continue
                db_lead = JobLead(
                    user_id=user.id,
                    portal=portal,
                    title=lead.get("title") or "",
                    company=lead.get("company") or "",
                    location=lead.get("location") or "",
                    url=url,
                    jd_text=lead.get("description") or lead.get("jd_text") or "",
                    experience=lead.get("experience") or "",
                    salary=lead.get("salary_info") or lead.get("salary") or "",
                    normalized_hash=norm,
                    raw_data=lead,
                )
                db.add(db_lead)
                inserted += 1

            await db.commit()
            fallback_run_id = f"fallback-{uuid.uuid4().hex[:8]}"
            return {
                "run_id": fallback_run_id,
                "status": "completed",
                "events": [
                    {"step": "adk_unavailable", "detail": adk_error},
                    {"step": "direct_scrape_complete", "inserted": inserted, "portal": portal},
                ],
                "error": None,
            }
        except Exception as scrape_err:
            logger.error(f"Direct scrape fallback also failed: {scrape_err}")
            return {
                "run_id": None,
                "status": "error",
                "events": [],
                "error": f"ADK unreachable and direct scrape failed: {scrape_err}",
            }

    return {
        "run_id": run_id,
        "status": "queued",
        "events": [{"step": "workflow_queued", "profile_id": str(profile.id)}],
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
    query = (
        select(JobLead, JobScore.fit_score, JobScore.decision.label("score_decision"))
        .outerjoin(JobScore, JobScore.job_lead_id == JobLead.id)
        .where(JobLead.user_id == user.id)
    )
    count_q = select(func.count(JobLead.id)).where(JobLead.user_id == user.id)

    if portal:
        query = query.where(JobLead.portal == portal)
        count_q = count_q.where(JobLead.portal == portal)
    if processed is not None:
        query = query.where(JobLead.processed == processed)
        count_q = count_q.where(JobLead.processed == processed)
    if status:
        query = query.where(JobScore.decision == status)
        count_q = (
            select(func.count(JobLead.id))
            .select_from(JobLead)
            .join(JobScore, JobScore.job_lead_id == JobLead.id)
            .where(JobLead.user_id == user.id, JobScore.decision == status)
        )
        if portal:
            count_q = count_q.where(JobLead.portal == portal)
        if processed is not None:
            count_q = count_q.where(JobLead.processed == processed)

    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    query = query.order_by(JobLead.discovered_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.all()

    items_out = []
    for row in items:
        lead = row[0] if hasattr(row, '__iter__') else row
        fit_score = row[1] if hasattr(row, '__iter__') else None
        score_decision = row[2] if hasattr(row, '__iter__') else None
        # Fallback: manual decisions stored in raw_data when no JobScore exists
        if not score_decision and lead.raw_data and isinstance(lead.raw_data, dict):
            score_decision = lead.raw_data.get("decision")
        d = JobLeadResponse.model_validate(lead).model_dump()
        d["fit_score"] = fit_score
        d["decision"] = score_decision
        items_out.append(d)

    return {"items": items_out, "total": total, "page": page, "page_size": page_size}


@router.post("/job-leads/{lead_id}/decision")
async def set_lead_decision(
    lead_id: str,
    body: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import update

    decision = body.get("decision")
    if decision not in ("approve", "skip"):
        raise HTTPException(status_code=400, detail="decision must be approve or skip")

    await db.execute(
        update(JobLead)
        .where(JobLead.id == lead_id, JobLead.user_id == user.id)
        .values(processed=True, raw_data={"decision": decision})
    )
    await db.commit()
    return {"ok": True, "decision": decision}


INTERNAL_SERVICE_TOKEN = os.getenv("INTERNAL_SERVICE_TOKEN", "jobblitz-internal-secret")


@router.post("/job-leads/bulk-internal", response_model=dict)
async def bulk_create_job_leads_internal(
    body: dict,
    x_service_token: str = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Internal endpoint for ADK orchestrator to bulk insert job leads."""
    if x_service_token != INTERNAL_SERVICE_TOKEN:
        raise HTTPException(status_code=403, detail="Forbidden")

    leads = body.get("leads", [])
    portal = body.get("portal", "naukri")
    user_id_str = body.get("user_id")
    if not user_id_str:
        raise HTTPException(status_code=400, detail="user_id required")

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid user_id")

    inserted = 0
    duplicates = 0

    for lead in leads:
        title = (lead.get("title") or "").strip().lower()
        company = (lead.get("company") or "").strip().lower()
        url = (lead.get("url") or "").strip()
        hash_input = f"{title}|{company}|{url}"
        normalized_hash = hashlib.sha256(hash_input.encode()).hexdigest()

        result = await db.execute(
            select(JobLead).where(
                JobLead.normalized_hash == normalized_hash,
                JobLead.user_id == user_uuid,
            )
        )
        if result.scalar_one_or_none():
            duplicates += 1
            continue

        db_lead = JobLead(
            user_id=user_uuid,
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


@router.get("/run/{run_id}/status")
async def get_run_status_proxy(
    run_id: str,
    user: User = Depends(get_current_user),
):
    # Fallback/direct runs are already completed — return immediately
    if run_id.startswith("fallback-") or run_id.startswith("direct-"):
        return {"status": "completed", "run_id": run_id, "progress": 100}

    """Proxy to ADK orchestrator run status."""
    import httpx
    adk_url = os.getenv("ADK_ORCHESTRATOR_URL", "http://adk-orchestrator:8001")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{adk_url}/agent/run/{run_id}/status")
            return resp.json()
    except Exception as e:
        return {"status": "completed", "run_id": run_id, "error": str(e)}


@router.get("/rate-status")
async def discovery_rate_status(
    portal: str = "naukri",
    user: User = Depends(get_current_user),
):
    stats = await get_apply_stats(str(user.id))
    return stats.get(portal, {"used": 0, "limit": 15, "remaining": 15})


@router.get("/debug/test-scraper")
async def test_scraper(
    keywords: str = "Python Developer",
    location: str = "Nagpur",
    user: User = Depends(get_current_user),
):
    """Temporary debug endpoint to test the Naukri scraper without the full discovery flow."""
    from app.services.scraper_service import scrape_naukri_jobs
    import logging
    logger = logging.getLogger(__name__)
    try:
        leads = await scrape_naukri_jobs(keywords=keywords, location=location, max_results=5)
        return {"count": len(leads), "leads": leads[:3]}
    except Exception as e:
        logger.error(f"Debug scraper error: {e}")
        return {"error": str(e), "count": 0}
