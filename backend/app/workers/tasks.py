from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import settings
from app.database import engine
from app.models import Application, Credential, JobListing, JobSearch, Profile, Resume, UsageLog, User
from app.services.scraper_service import scrape_linkedin_jobs, scrape_naukri_jobs
from app.services.apply_service import apply_to_job

_async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


def _run_async(coro):
    """Run an async coroutine from a sync Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@shared_task(name="app.workers.tasks.discover_jobs_task")
def discover_jobs_task() -> dict:
    """Discover jobs for all active searches."""
    return _run_async(_discover_jobs_async())


async def _discover_jobs_async() -> dict:
    discovered = 0
    async with _async_session() as db:
        # Get all active searches
        result = await db.execute(select(JobSearch).where(JobSearch.is_active == True))
        searches = result.scalars().all()

        for search in searches:
            try:
                jobs: list[dict] = []
                if search.platform in ("linkedin", "both"):
                    linkedin_jobs = await scrape_linkedin_jobs(
                        keywords=search.keywords,
                        location=search.location,
                        experience_level=search.experience_level,
                        remote_only=search.remote_only,
                    )
                    jobs.extend(linkedin_jobs)

                if search.platform in ("naukri", "both"):
                    naukri_jobs = await scrape_naukri_jobs(
                        keywords=search.keywords,
                        location=search.location,
                        experience_level=search.experience_level,
                    )
                    jobs.extend(naukri_jobs)

                for job_data in jobs:
                    # Skip duplicates
                    if job_data.get("external_job_id"):
                        dup = await db.execute(
                            select(JobListing).where(
                                JobListing.user_id == search.user_id,
                                JobListing.external_job_id == job_data["external_job_id"],
                                JobListing.platform == job_data.get("platform", ""),
                            )
                        )
                        if dup.scalar_one_or_none():
                            continue

                    listing = JobListing(
                        user_id=search.user_id,
                        job_search_id=search.id,
                        platform=job_data.get("platform", search.platform),
                        external_job_id=job_data.get("external_job_id"),
                        title=job_data.get("title", ""),
                        company=job_data.get("company", ""),
                        location=job_data.get("location"),
                        description=job_data.get("description"),
                        apply_url=job_data.get("apply_url"),
                        salary_info=job_data.get("salary_info"),
                        posted_date=job_data.get("posted_date"),
                        status="discovered",
                    )
                    db.add(listing)
                    discovered += 1

                search.last_run_at = datetime.now(timezone.utc)
                await db.commit()

                # Log usage
                log = UsageLog(
                    user_id=search.user_id,
                    action="discover",
                    details={"search_id": str(search.id), "found": len(jobs)},
                )
                db.add(log)
                await db.commit()

            except Exception:
                await db.rollback()
                continue

    return {"discovered": discovered}


@shared_task(name="app.workers.tasks.auto_apply_task")
def auto_apply_task(user_id: str, job_listing_id: str, resume_id: str | None = None) -> dict:
    """Apply to a specific job listing."""
    return _run_async(_auto_apply_async(user_id, job_listing_id, resume_id))


async def _auto_apply_async(user_id: str, job_listing_id: str, resume_id: str | None) -> dict:
    uid = uuid.UUID(user_id)
    lid = uuid.UUID(job_listing_id)

    async with _async_session() as db:
        # Get user
        user_result = await db.execute(select(User).where(User.id == uid))
        user = user_result.scalar_one_or_none()
        if not user:
            return {"success": False, "error": "User not found"}

        # Get listing
        listing_result = await db.execute(select(JobListing).where(JobListing.id == lid))
        listing = listing_result.scalar_one_or_none()
        if not listing:
            return {"success": False, "error": "Job listing not found"}

        # Get credentials
        cred_result = await db.execute(
            select(Credential).where(
                Credential.user_id == uid,
                Credential.platform == listing.platform,
                Credential.is_active == True,
            )
        )
        credential = cred_result.scalar_one_or_none()
        if not credential:
            return {"success": False, "error": "No active credentials"}

        # Get profile
        prof_result = await db.execute(select(Profile).where(Profile.user_id == uid))
        profile = prof_result.scalar_one_or_none()
        profile_dict = {
            "full_name": user.full_name,
            "email": user.email,
            "phone": user.phone or "",
            "location": user.location or "",
            "first_name": user.full_name.split()[0] if user.full_name else "",
            "last_name": " ".join(user.full_name.split()[1:]) if user.full_name and len(user.full_name.split()) > 1 else "",
            "headline": profile.headline or "" if profile else "",
            "summary": profile.summary or "" if profile else "",
            "skills": profile.skills or {} if profile else {},
            "experience": profile.experience or {} if profile else {},
            "education": profile.education or {} if profile else {},
        }

        # Get resume
        resume_path = None
        if resume_id:
            res_result = await db.execute(select(Resume).where(Resume.id == uuid.UUID(resume_id)))
            resume = res_result.scalar_one_or_none()
            if resume:
                resume_path = resume.file_path
        else:
            res_result = await db.execute(select(Resume).where(Resume.user_id == uid, Resume.is_default == True))
            resume = res_result.scalar_one_or_none()
            if resume:
                resume_path = resume.file_path

        # Create application
        application = Application(
            user_id=uid,
            job_listing_id=lid,
            resume_id=uuid.UUID(resume_id) if resume_id else (resume.id if resume else None),
            status="pending",
        )
        db.add(application)
        listing.status = "applied"
        await db.commit()
        await db.refresh(application)

        # Apply
        success, error, screenshot_path, answers = await apply_to_job(
            apply_url=listing.apply_url or "",
            user_id=uid,
            profile=profile_dict,
            platform=listing.platform,
            username=credential.username,
            encrypted_password=credential.encrypted_password,
            resume_path=resume_path,
        )

        if success:
            application.status = "submitted"
            application.applied_at = datetime.now(timezone.utc)
        else:
            if application.retry_count < 1:
                application.retry_count += 1
                application.error_message = error
            else:
                application.status = "failed"
                application.error_message = error
                listing.status = "failed"

        application.screenshot_path = screenshot_path
        application.answers_used = answers
        await db.commit()

        return {"success": success, "application_id": str(application.id), "error": error}


@shared_task(name="app.workers.tasks.retry_failed_task")
def retry_failed_task() -> dict:
    """Retry pending applications that had a first failure."""
    return _run_async(_retry_failed_async())


async def _retry_failed_async() -> dict:
    retried = 0
    async with _async_session() as db:
        result = await db.execute(
            select(Application).where(Application.status == "pending", Application.retry_count == 1)
        )
        apps = result.scalars().all()

        for app in apps:
            try:
                listing_result = await db.execute(select(JobListing).where(JobListing.id == app.job_listing_id))
                listing = listing_result.scalar_one_or_none()
                if not listing:
                    continue

                user_result = await db.execute(select(User).where(User.id == app.user_id))
                user = user_result.scalar_one_or_none()
                if not user:
                    continue

                cred_result = await db.execute(
                    select(Credential).where(
                        Credential.user_id == app.user_id,
                        Credential.platform == listing.platform,
                        Credential.is_active == True,
                    )
                )
                credential = cred_result.scalar_one_or_none()
                if not credential:
                    continue

                prof_result = await db.execute(select(Profile).where(Profile.user_id == app.user_id))
                profile = prof_result.scalar_one_or_none()
                profile_dict = {
                    "full_name": user.full_name,
                    "email": user.email,
                    "phone": user.phone or "",
                    "location": user.location or "",
                    "first_name": user.full_name.split()[0] if user.full_name else "",
                    "last_name": " ".join(user.full_name.split()[1:]) if user.full_name and len(user.full_name.split()) > 1 else "",
                    "headline": profile.headline or "" if profile else "",
                    "summary": profile.summary or "" if profile else "",
                    "skills": profile.skills or {} if profile else {},
                    "experience": profile.experience or {} if profile else {},
                    "education": profile.education or {} if profile else {},
                }

                resume_path = None
                if app.resume_id:
                    res_result = await db.execute(select(Resume).where(Resume.id == app.resume_id))
                    resume = res_result.scalar_one_or_none()
                    if resume:
                        resume_path = resume.file_path

                success, error, screenshot_path, answers = await apply_to_job(
                    apply_url=listing.apply_url or "",
                    user_id=app.user_id,
                    profile=profile_dict,
                    platform=listing.platform,
                    username=credential.username,
                    encrypted_password=credential.encrypted_password,
                    resume_path=resume_path,
                )

                if success:
                    app.status = "submitted"
                    app.applied_at = datetime.now(timezone.utc)
                    listing.status = "applied"
                else:
                    app.status = "failed"
                    app.error_message = error
                    listing.status = "failed"

                app.screenshot_path = screenshot_path
                app.answers_used = answers
                await db.commit()
                retried += 1

            except Exception:
                await db.rollback()
                continue

    return {"retried": retried}


@shared_task(name="app.workers.tasks.notify_user_task")
def notify_user_task(user_id: str, message: str) -> dict:
    """Placeholder for user notification (email/push)."""
    # In production, integrate with email/SMS/push notification service
    return {"user_id": user_id, "message": message, "sent": True}
