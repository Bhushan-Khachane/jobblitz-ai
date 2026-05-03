from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

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


@shared_task(name="app.workers.tasks.cleanup_old_listings_task")
def cleanup_old_listings_task() -> dict:
    """Delete job listings older than 30 days that were never applied to."""
    return _run_async(_cleanup_old_listings_async())


async def _cleanup_old_listings_async() -> dict:
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    deleted = 0
    async with _async_session() as db:
        try:
            result = await db.execute(
                select(JobListing).where(
                    JobListing.created_at < cutoff,
                    JobListing.status == "discovered",
                )
            )
            old_listings = result.scalars().all()

            for listing in old_listings:
                await db.delete(listing)
                deleted += 1

            await db.commit()
        except Exception:
            await db.rollback()
            raise

    return {"deleted": deleted}


@shared_task(name="app.workers.tasks.check_application_statuses_task")
def check_application_statuses_task() -> dict:
    """Check for stale pending/failed applications and mark them."""
    return _run_async(_check_application_statuses_async())


async def _check_application_statuses_async() -> dict:
    stale_cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    updated = 0
    async with _async_session() as db:
        try:
            # Mark applications stuck in pending for > 48h as failed
            result = await db.execute(
                select(Application).where(
                    Application.status == "pending",
                    Application.created_at < stale_cutoff,
                )
            )
            stale_apps = result.scalars().all()

            for app in stale_apps:
                app.status = "failed"
                app.error_message = "Application timed out — no response after 48 hours"
                updated += 1

            # Mark applied applications with no status update for > 7 days
            seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
            result2 = await db.execute(
                select(Application).where(
                    Application.status == "submitted",
                    Application.applied_at < seven_days_ago,
                )
            )
            old_submitted = result2.scalars().all()

            for app in old_submitted:
                app.status = "rejected"
                app.error_message = "Auto-marked: no update received within 7 days"
                updated += 1

            await db.commit()
        except Exception:
            await db.rollback()
            raise

    return {"updated": updated}


@shared_task(name="app.workers.tasks.batch_auto_apply_task")
def batch_auto_apply_task() -> dict:
    """Dispatch auto_apply_task for all discovered listings, respecting rate limits."""
    return _run_async(_batch_auto_apply_async())


async def _batch_auto_apply_async() -> dict:
    dispatched = 0
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    async with _async_session() as db:
        try:
            # Get all discovered job listings
            result = await db.execute(
                select(JobListing).where(JobListing.status == "discovered")
            )
            listings = result.scalars().all()

            # Group listings by user_id for rate-limit checking
            user_counts: dict[str, int] = {}

            for listing in listings:
                uid = str(listing.user_id)

                # Count today's applications for this user (cached per batch run)
                if uid not in user_counts:
                    count_result = await db.execute(
                        select(Application).where(
                            Application.user_id == listing.user_id,
                            Application.created_at >= today_start,
                        )
                    )
                    user_counts[uid] = len(count_result.scalars().all())

                # Get user to check daily limit
                user_result = await db.execute(select(User).where(User.id == listing.user_id))
                user = user_result.scalar_one_or_none()
                if not user:
                    continue

                daily_limit = user.daily_apply_limit if hasattr(user, "daily_apply_limit") and user.daily_apply_limit else settings.MAX_APPLICATIONS_PER_DAY
                if user_counts[uid] >= daily_limit:
                    continue

                # Verify user has active credentials for this platform
                cred_result = await db.execute(
                    select(Credential).where(
                        Credential.user_id == listing.user_id,
                        Credential.platform == listing.platform,
                        Credential.is_active == True,
                    )
                )
                if not cred_result.scalar_one_or_none():
                    continue

                # Dispatch the individual apply task
                auto_apply_task.delay(
                    user_id=uid,
                    job_listing_id=str(listing.id),
                )
                user_counts[uid] += 1
                dispatched += 1

        except Exception:
            raise

    return {"dispatched": dispatched}


# ── Celery Beat schedule ─────────────────────────────────────────────────────

from celery.schedules import crontab
from app.workers.celery_app import celery_app

celery_app.conf.beat_schedule = {
    "discover-jobs-every-2-hours": {
        "task": "app.workers.tasks.discover_jobs_task",
        "schedule": crontab(minute=0, hour="*/2"),
        "options": {"queue": "default"},
    },
    "auto-apply-every-30-mins": {
        "task": "app.workers.tasks.batch_auto_apply_task",
        "schedule": crontab(minute="*/30"),
        "options": {"queue": "default"},
    },
    "cleanup-old-data-weekly": {
        "task": "app.workers.tasks.cleanup_old_listings_task",
        "schedule": crontab(hour=2, minute=0, day_of_week=0),
        "options": {"queue": "default"},
    },
    "check-application-status-daily": {
        "task": "app.workers.tasks.check_application_statuses_task",
        "schedule": crontab(hour=9, minute=0),
        "options": {"queue": "default"},
    },
}

celery_app.conf.task_routes = {
    "app.workers.tasks.auto_apply_task": {"queue": "apply_queue"},
    "app.workers.tasks.*": {"queue": "default"},
}
