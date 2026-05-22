from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import settings
from app.database import engine
from app.models import Application, Credential, DeadLetterLog, JobListing, JobSearch, Profile, Resume, UsageLog, User
from app.services.matching_service import match_job_to_resume_detailed
from app.services.scraper_service import scrape_linkedin_jobs, scrape_naukri_jobs

import logging

logger = logging.getLogger(__name__)

_async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def _log_to_dead_letter(task_name: str, task_args: dict | None, error_message: str, retry_count: int = 0) -> None:
    """Log a failed task to the dead-letter table for later inspection/replay."""
    async with _async_session() as db:
        entry = DeadLetterLog(
            task_name=task_name,
            task_args=task_args,
            error_message=error_message[:4000],
            retry_count=retry_count,
        )
        db.add(entry)
        await db.commit()


def _build_keywords(profile: Profile | None, search_keywords: str) -> str:
    """Build search keywords from resume profile data when auto_match is enabled."""
    base = search_keywords.strip()
    if not profile:
        return base

    parts = [base]
    seen = {base.lower()}

    if profile.preferred_job_titles:
        for title in profile.preferred_job_titles[:2]:
            t_lower = title.lower()
            if t_lower not in seen:
                seen.add(t_lower)
                parts.append(title)

    if profile.skills:
        short_skills = [s for s in profile.skills if len(s.split()) <= 3][:3]
        for skill in short_skills:
            s_lower = skill.lower()
            if s_lower not in seen:
                seen.add(s_lower)
                parts.append(skill)

    return ", ".join(parts)


# ── ARQ Task Functions ──────────────────────────────────────────────────────────


async def discover_jobs(ctx: dict, user_id: str | None = None, search_id: str | None = None) -> dict:
    """Discover jobs for all active searches. Runs every 2 hours via ARQ cron.
    When user_id and/or search_id are provided, only those searches are processed."""
    total_discovered = 0
    async with _async_session() as db:
        query = select(JobSearch).where(JobSearch.is_active)
        if user_id:
            query = query.where(JobSearch.user_id == uuid.UUID(user_id))
        if search_id:
            query = query.where(JobSearch.id == uuid.UUID(search_id))
        result = await db.execute(query)
        searches = result.scalars().all()

        for search in searches:
            search_id = search.id
            user_id = search.user_id
            search_discovered = 0
            try:
                # Load user's default resume and profile for auto-match mode
                resume_text = ""
                profile: Profile | None = None
                if search.auto_match:
                    prof_result = await db.execute(select(Profile).where(Profile.user_id == user_id))
                    profile = prof_result.scalar_one_or_none()
                    res_result = await db.execute(
                        select(Resume).where(Resume.user_id == user_id, Resume.is_default)
                    )
                    resume = res_result.scalar_one_or_none()
                    if resume and resume.parsed_text:
                        resume_text = resume.parsed_text

                keywords = _build_keywords(profile, search.keywords) if search.auto_match else search.keywords

                logger.info(f"Starting job discovery for search {search_id} (user {user_id}): platform={search.platform}, keywords='{keywords}', location={search.location}")

                jobs: list[dict] = []
                if search.platform == "linkedin":
                    logger.info(f"Scraping LinkedIn jobs for '{keywords}' in {search.location or 'anywhere'}...")
                    linkedin_jobs = await scrape_linkedin_jobs(
                        keywords=keywords,
                        location=search.location,
                        experience_level=search.experience_level,
                        remote_only=search.remote_only,
                    )
                    logger.info(f"LinkedIn scraper found {len(linkedin_jobs)} jobs")
                    jobs.extend(linkedin_jobs)

                elif search.platform == "naukri":
                    logger.info(f"Scraping Naukri jobs for '{keywords}' in {search.location or 'anywhere'}...")
                    naukri_jobs = await scrape_naukri_jobs(
                        keywords=keywords,
                        location=search.location,
                        experience_level=search.experience_level,
                    )
                    logger.info(f"Naukri scraper found {len(naukri_jobs)} jobs")
                    jobs.extend(naukri_jobs)

                else:
                    logger.warning(f"Scraper for platform '{search.platform}' not yet implemented — skipping search {search_id}")
                    continue

                logger.info(f"Total jobs found for search {search_id}: {len(jobs)}")

                duplicates_skipped = 0
                low_match_skipped = 0

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
                            logger.debug(f"Skipping duplicate job: {job_data.get('title')} at {job_data.get('company')}")
                            duplicates_skipped += 1
                            continue

                    # Score the job against the resume
                    match_score = None
                    match_explanation = None
                    if resume_text:
                        result_obj = await match_job_to_resume_detailed(
                            job_title=job_data.get("title", ""),
                            job_description=job_data.get("description", ""),
                            resume_text=resume_text,
                            profile_skills=profile.skills if profile else None,
                            profile_job_titles=profile.preferred_job_titles if profile else None,
                            job_location=job_data.get("location"),
                            job_salary=job_data.get("salary_info"),
                            preferred_locations=profile.preferred_locations if profile else None,
                            expected_salary_lpa=profile.expected_salary_lpa if profile else None,
                            notice_period_days=profile.notice_period_days if profile else None,
                            experience_years=profile.experience_years if profile else None,
                        )
                        match_score = result_obj.final_score
                        match_explanation = result_obj.to_dict()

                        # Skip low-match jobs
                        if match_score is not None and match_score < settings.MIN_MATCH_SCORE_TO_SAVE:
                            logger.debug(
                                f"Skipped low-match job '{job_data.get('title')}' "
                                f"score={match_score} for search {search_id}"
                            )
                            low_match_skipped += 1
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
                        match_score=match_score,
                        match_explanation=match_explanation,
                    )
                    db.add(listing)
                    search_discovered += 1
                    total_discovered += 1

                logger.info(f"Job discovery for search {search_id}: {len(jobs)} total, {duplicates_skipped} duplicates, {low_match_skipped} low-match, {search_discovered} saved")

                search.last_run_at = datetime.now(timezone.utc)
                await db.commit()

                # Log usage
                log = UsageLog(
                    user_id=search.user_id,
                    action="discover",
                    details={
                        "search_id": str(search.id),
                        "found": len(jobs),
                        "saved": search_discovered,
                        "keywords": keywords,
                    },
                )
                db.add(log)
                await db.commit()

            except Exception as e:
                await db.rollback()
                logger.error(
                    f"Discovery failed for search {search_id} (user {user_id}): {e}",
                    exc_info=True,
                )
                continue

    return {"discovered": total_discovered}


async def auto_apply(ctx: dict, user_id: str, job_listing_id: str, resume_id: str | None = None) -> dict:
    """Apply to a specific job listing. Retries up to 3 times on failure, then dead-letters."""
    job_try = ctx.get("job_try", 1)
    uid = uuid.UUID(user_id)
    lid = uuid.UUID(job_listing_id)

    # Idempotency: skip if already applied
    idempotency_key = f"apply:{uid}:{lid}"

    async with _async_session() as db:
        # Check for existing application
        existing = await db.execute(
            select(Application).where(Application.idempotency_key == idempotency_key)
        )
        if existing_app := existing.scalar_one_or_none():
            if existing_app.status in ("submitted", "applied"):
                logger.info(f"Skipping duplicate apply for {idempotency_key} — already {existing_app.status}")
                return {"success": True, "application_id": str(existing_app.id), "skipped": True}

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

        # Verify user has platform access (credentials or active portal session)
        from app.dependencies import has_platform_access
        if not await has_platform_access(uid, listing.platform, db):
            return {"success": False, "error": "No active credentials or portal session"}

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
            "skills": profile.skills or [] if profile else [],
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
            res_result = await db.execute(select(Resume).where(Resume.user_id == uid, Resume.is_default))
            resume = res_result.scalar_one_or_none()
            if resume:
                resume_path = resume.file_path

        # Try to find the existing application record (created by router)
        existing_by_listing = await db.execute(
            select(Application).where(
                Application.user_id == uid,
                Application.job_listing_id == lid,
            )
        )
        application = existing_by_listing.scalar_one_or_none()
        if not application:
            # Create one only if it doesn't exist (direct task dispatch)
            application = Application(
                user_id=uid,
                job_listing_id=lid,
                resume_id=uuid.UUID(resume_id) if resume_id else (resume.id if resume else None),
                status="pending",
                idempotency_key=idempotency_key,
            )
            db.add(application)
            listing.status = "applied"
            await db.commit()
            await db.refresh(application)

        # Apply using browser pool + ATS router
        from app.services.browser_pool import browser_pool
        from app.services.ats_router import route_apply
        from app.services.circuit_breaker import circuit_breaker

        # Check circuit breaker before attempting
        if await circuit_breaker.is_open(listing.platform):
            logger.warning(f"Circuit open for {listing.platform}, skipping apply")
            application.status = "failed"
            application.error_message = f"Platform {listing.platform} temporarily unavailable (circuit open)"
            await db.commit()
            return {"success": False, "application_id": str(application.id), "error": "circuit_open"}

        success = False
        error = None
        screenshot_path = None
        answers_used = None
        assisted_mode = False  # default; overridden after successful apply
        try:
            browser_ctx = await browser_pool.acquire_for_user_with_portal(
                user_id=str(user.id),
                platform=listing.platform,
                task_type="apply",
                user_tier="pro" if user.daily_apply_limit > 50 else "free",
            )
            page = await browser_ctx.new_page()
            try:
                job_dict = {
                    "id": str(listing.id),
                    "title": listing.title,
                    "company": listing.company,
                    "apply_url": listing.apply_url,
                    "platform": listing.platform,
                    "description": listing.description,
                }
                result = await route_apply(page, job_dict, profile_dict, resume_path, user_id=uid)
                success = result.success
                error = result.error
                answers_used = result.answers_used
                assisted_mode = getattr(result, "mode", "auto") == "assisted"
                # Save screenshot bytes to disk and store the path
                if result.screenshot:
                    try:
                        import os
                        screenshot_dir = "/tmp/jobblitz_screenshots"
                        os.makedirs(screenshot_dir, exist_ok=True)
                        screenshot_file = f"{screenshot_dir}/apply_{application.id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.png"
                        with open(screenshot_file, "wb") as f:
                            f.write(result.screenshot)
                        screenshot_path = screenshot_file
                    except Exception as screenshot_err:
                        logger.warning(f"Failed to save screenshot for apply {application.id}: {screenshot_err}")
                        screenshot_path = None
                # Record circuit breaker outcome
                if success:
                    await circuit_breaker.record_success(listing.platform)
                else:
                    await circuit_breaker.record_failure(listing.platform)
            finally:
                await page.close()
                # Close isolated context directly — do NOT return to shared pool
                try:
                    await browser_ctx.close()
                except Exception:
                    pass
        except Exception as apply_err:
            success = False
            error = str(apply_err)
            await circuit_breaker.record_failure(listing.platform)
            logger.error(f"Apply failed for listing {lid}: {apply_err}", exc_info=True)

        if success:
            if assisted_mode:
                application.status = "pending_manual"
                application.approval_status = "pending_approval"
                listing.status = "pending_manual"
            else:
                application.status = "submitted"
                listing.status = "applied"
                application.applied_at = datetime.now(timezone.utc)
        else:
            # External apply jobs are not failures — just skip them
            if error and "external apply" in error.lower():
                application.status = "rejected"
                application.error_message = error
                listing.status = "skipped"
            elif application.retry_count < 1:
                application.retry_count += 1
                application.error_message = error
            else:
                application.status = "failed"
                application.error_message = error
                listing.status = "failed"

        application.screenshot_path = screenshot_path
        application.answers_used = answers_used
        await db.commit()

        # Dead-letter on final failure
        if not success and job_try >= 3:
            await _log_to_dead_letter(
                task_name="auto_apply",
                task_args={"user_id": user_id, "job_listing_id": job_listing_id, "resume_id": resume_id},
                error_message=error or "Unknown error",
                retry_count=job_try,
            )

        return {"success": success, "application_id": str(application.id), "error": error}


async def retry_failed(ctx: dict) -> dict:
    """Re-enqueue failed applications that haven't hit max retries."""
    retried = 0
    redis_pool = ctx["redis"]
    async with _async_session() as db:
        result = await db.execute(
            select(Application).where(
                Application.status == "failed",
                Application.retry_count < 3,
            )
        )
        apps = result.scalars().all()

        for app in apps:
            await redis_pool.enqueue_job(
                "auto_apply",
                user_id=str(app.user_id),
                job_listing_id=str(app.job_listing_id),
                resume_id=str(app.resume_id) if app.resume_id else None,
            )
            app.retry_count += 1
            retried += 1

        await db.commit()

    return {"retried": retried}


async def notify_user(ctx: dict, user_id: str, message: str) -> dict:
    """Placeholder for user notification (email/push)."""
    return {"user_id": user_id, "message": message, "sent": True}


async def cleanup_old_listings(ctx: dict) -> dict:
    """Delete job listings older than 30 days that were never applied to."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    async with _async_session() as db:
        try:
            from sqlalchemy import delete
            result = await db.execute(
                delete(JobListing).where(
                    JobListing.created_at < cutoff,
                    JobListing.status == "discovered",
                )
            )
            await db.commit()
            return {"deleted": result.rowcount}
        except Exception as e:
            await db.rollback()
            logger.error(f"Cleanup old listings failed: {e}", exc_info=True)
            raise


async def check_application_statuses(ctx: dict) -> dict:
    """Check for stale pending/failed applications and mark them."""
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
        except Exception as e:
            await db.rollback()
            logger.error(f"Check application statuses failed: {e}", exc_info=True)
            raise

    return {"updated": updated}


async def batch_auto_apply(ctx: dict) -> dict:
    """Dispatch auto_apply for all discovered listings, respecting rate limits."""
    dispatched = 0
    queued_for_approval = 0
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    async with _async_session() as db:
        try:
            # Get discovered job listings with sufficient match score
            result = await db.execute(
                select(JobListing).where(
                    JobListing.status == "discovered",
                    JobListing.match_score >= settings.MIN_MATCH_SCORE_TO_APPLY,
                )
            )
            listings = result.scalars().all()

            # Group listings by user_id for rate-limit checking
            user_counts: dict[str, int] = {}
            user_cache: dict[str, User] = {}

            # Single query: count today's applications per user (avoids N+1)
            from sqlalchemy import func as sqlfunc
            counts_result = await db.execute(
                select(Application.user_id, sqlfunc.count(Application.id).label("cnt"))
                .where(Application.created_at >= today_start)
                .group_by(Application.user_id)
            )
            user_counts = {
                str(row.user_id): row.cnt for row in counts_result
            }

            redis_pool = ctx["redis"]

            for listing in listings:
                uid = str(listing.user_id)

                # Load and cache user
                if uid not in user_cache:
                    user_result = await db.execute(select(User).where(User.id == listing.user_id))
                    user = user_result.scalar_one_or_none()
                    if not user:
                        continue
                    user_cache[uid] = user
                user = user_cache[uid]

                current_count = user_counts.get(uid, 0)
                daily_limit = user.daily_apply_limit if user.daily_apply_limit else settings.MAX_APPLICATIONS_PER_DAY
                if current_count >= daily_limit:
                    continue

                # Verify user has platform access (credentials or active portal session)
                from app.dependencies import has_platform_access
                if not await has_platform_access(listing.user_id, listing.platform, db):
                    continue

                # Skip if an active application already exists for this listing.
                # "pending" + "approved" is the exception — those need auto_apply dispatch.
                existing_app_result = await db.execute(
                    select(Application).where(
                        Application.job_listing_id == listing.id,
                        Application.status.in_(["submitted", "applied", "pending_manual", "queued", "pending"]),
                    )
                )
                existing_app = existing_app_result.scalar_one_or_none()
                if existing_app:
                    if existing_app.status == "pending" and existing_app.approval_status == "approved":
                        pass  # will dispatch auto_apply below
                    else:
                        continue

                # Get user's default resume
                res_result = await db.execute(
                    select(Resume).where(Resume.user_id == listing.user_id, Resume.is_default)
                )
                resume = res_result.scalar_one_or_none()

                application_mode = getattr(user, "application_mode", "assisted") or "assisted"

                if application_mode == "manual":
                    listing.status = "discovered"
                    continue

                if application_mode == "assisted":
                    # Duplicate check
                    idempotency_key = f"apply:{listing.user_id}:{listing.id}"
                    existing_check = await db.execute(
                        select(Application).where(
                            Application.idempotency_key == idempotency_key
                        )
                    )
                    if existing_check.scalar_one_or_none():
                        continue

                    # Assisted mode: create application with pending_approval status
                    app = Application(
                        user_id=listing.user_id,
                        job_listing_id=listing.id,
                        resume_id=resume.id if resume else None,
                        status="pending",
                        approval_status="pending_approval",
                        idempotency_key=idempotency_key,
                    )
                    db.add(app)
                    await db.commit()
                    queued_for_approval += 1
                    user_counts[uid] = user_counts.get(uid, 0) + 1
                    continue

                # Auto mode: enqueue the individual apply task
                await redis_pool.enqueue_job(
                    "auto_apply",
                    user_id=uid,
                    job_listing_id=str(listing.id),
                )
                listing.status = "queued"
                user_counts[uid] = user_counts.get(uid, 0) + 1
                dispatched += 1

            await db.commit()

        except Exception as e:
            logger.error(f"Batch auto-apply dispatch failed: {e}", exc_info=True)
            raise

    return {"dispatched": dispatched, "queued_for_approval": queued_for_approval}


async def run_discovery_scoring(ctx: dict, user_id: str | None = None) -> dict:
    """Discovery + 5-factor scoring pipeline for JobRecommendations table.

    1. Load user's active JobSearches
    2. Scrape jobs from each platform
    3. Parse candidate profile
    4. Score each job (skill, experience, cert, location, domain)
    5. Deduplicate by user_id + external_job_id
    6. Save to job_recommendations
    """
    from app.services.match_scorer import CandidateProfile, JobListing as ScorerJob, compute_match_score, priority_tier, enrich_job_with_llm
    from app.services.profile_parser import parse_candidate_profile
    from app.services.salary_estimator import estimate_salary
    from app.models import JobRecommendation

    total_scored = 0
    total_saved = 0
    duplicates_skipped = 0
    low_score_skipped = 0

    async with _async_session() as db:
        # Build search query
        search_query = select(JobSearch).where(JobSearch.is_active == True)
        if user_id:
            search_query = search_query.where(JobSearch.user_id == uuid.UUID(user_id))
        result = await db.execute(search_query)
        searches = result.scalars().all()

        for search in searches:
            search_id_str = str(search.id)
            search_user_id = search.user_id
            uid = str(search_user_id)
            try:
                # Parse candidate profile
                profile = await parse_candidate_profile(uid, db)
                if not profile:
                    logger.warning(f"No profile for user {uid}, skipping search {search_id_str}")
                    continue

                # Scrape jobs
                keywords = search.keywords
                location = search.location
                exp_level = search.experience_level
                remote_only = search.remote_only

                # Run scrapers in isolated subprocesses via PlaywrightExecutor
                from browser.playwright_executor import playwright_executor
                raw_jobs: list[dict] = []
                platforms = [p.strip() for p in search.platform.split(",")] if "," in search.platform else [search.platform]
                scraper_tasks = []
                for platform in platforms:
                    platform = platform.strip().lower()
                    if platform == "linkedin":
                        scraper_tasks.append(
                            playwright_executor.run_scraper(
                                scraper_fn_path="app.services.scraper_service.scrape_linkedin_jobs",
                                timeout_seconds=90,
                                keywords=keywords,
                                location=location,
                                experience_level=exp_level,
                                remote_only=remote_only,
                                max_results=20,
                            )
                        )
                    elif platform == "naukri":
                        scraper_tasks.append(
                            playwright_executor.run_scraper(
                                scraper_fn_path="app.services.scraper_service.scrape_naukri_jobs",
                                timeout_seconds=90,
                                keywords=keywords,
                                location=location,
                                experience_level=exp_level,
                                max_results=20,
                            )
                        )
                    else:
                        logger.warning(f"Platform '{platform}' not implemented for discovery scoring")

                if scraper_tasks:
                    scraper_results = await asyncio.gather(*scraper_tasks, return_exceptions=True)
                    for res in scraper_results:
                        if isinstance(res, list):
                            raw_jobs.extend(res)
                        else:
                            logger.warning(f"Scraper returned exception: {res}")

                # Graceful degradation: if ALL scrapers returned empty, do NOT wipe existing recommendations
                if len(raw_jobs) == 0:
                    logger.warning(f"All scrapers returned 0 jobs for user {uid} search {search_id_str}")
                    continue

                logger.info(f"Discovery scoring for search {search_id_str}: {len(raw_jobs)} raw jobs from {platforms}")

                for job_data in raw_jobs:
                    try:
                        ext_id = job_data.get("external_job_id") or ""
                        if not ext_id:
                            # fallback ID from title + company hash
                            ext_id = hashlib.md5(f"{job_data.get('title','')}-{job_data.get('company','')}".encode()).hexdigest()[:16]

                        # Deduplicate against existing job_recommendations
                        dup_check = await db.execute(
                            select(JobRecommendation).where(
                                JobRecommendation.user_id == search_user_id,
                                JobRecommendation.job_id == ext_id,
                            )
                        )
                        if dup_check.scalar_one_or_none():
                            duplicates_skipped += 1
                            continue

                        # Build scorer JobListing
                        exp_text = job_data.get("experience", "")
                        # Try to extract min/max years from text
                        from app.services.match_scorer import _extract_experience_regex
                        exp_min, exp_max = _extract_experience_regex(exp_text)

                        scorer_job = ScorerJob(
                            job_id=ext_id,
                            company=job_data.get("company", ""),
                            role=job_data.get("title", ""),
                            location=job_data.get("location"),
                            job_type=job_data.get("job_type"),
                            description=job_data.get("description", ""),
                            experience_required=exp_text,
                            salary_raw=job_data.get("salary_info"),
                            apply_link=job_data.get("apply_url", ""),
                            source_portal=job_data.get("platform", ""),
                            experience_min=exp_min,
                            experience_max=exp_max,
                        )

                        # Enrich with LLM if description is sparse
                        if len(scorer_job.description) < 200:
                            try:
                                await enrich_job_with_llm(scorer_job)
                            except Exception as enrich_err:
                                logger.warning(f"LLM enrichment failed for {ext_id}: {enrich_err}")

                        # Compute match score
                        match_score, breakdown = compute_match_score(profile, scorer_job)
                        total_scored += 1

                        # Skip very low scores
                        if match_score < 0.5:
                            low_score_skipped += 1
                            continue

                        # Estimate salary if missing
                        salary_estimate = job_data.get("salary_info")
                        if not salary_estimate and match_score >= 0.6:
                            try:
                                est = await estimate_salary(
                                    title=scorer_job.role,
                                    company=scorer_job.company,
                                    location=scorer_job.location or "India",
                                    experience_required=scorer_job.experience_required,
                                    skills=scorer_job.primary_skills or [],
                                )
                                salary_estimate = f"{est.get('min_lpa', 0)}-{est.get('max_lpa', 0)} LPA"
                            except Exception as sal_err:
                                logger.warning(f"Salary estimation failed: {sal_err}")

                        # Build skill breakdown for UI
                        skill_breakdown = {
                            "matched": list(
                                set(s.lower() for s in profile.core_skills) &
                                set(s.lower() for s in (scorer_job.primary_skills or []))
                            ),
                            "missing": list(
                                set(s.lower() for s in (scorer_job.primary_skills or [])) -
                                set(s.lower() for s in profile.core_skills)
                            ),
                            "all_scores": breakdown,
                        }

                        rec = JobRecommendation(
                            user_id=search_user_id,
                            job_id=ext_id,
                            company=scorer_job.company or None,
                            role=scorer_job.role or None,
                            location=scorer_job.location or None,
                            job_type=scorer_job.job_type or None,
                            experience_required=scorer_job.experience_required or None,
                            salary_estimate=salary_estimate or None,
                            match_score=match_score,
                            match_score_pct=int(match_score * 100),
                            priority_tier=priority_tier(match_score),
                            skill_breakdown=skill_breakdown,
                            apply_link=scorer_job.apply_link or None,
                            source_portal=scorer_job.source_portal or None,
                            raw_description=scorer_job.description[:2000] if scorer_job.description else None,
                            discovered_at=datetime.now(timezone.utc),
                            status="discovered",
                        )
                        db.add(rec)
                        total_saved += 1

                    except Exception as inner_err:
                        logger.warning(f"Failed to score job {job_data.get('title')}: {inner_err}")
                        continue

                search.last_run_at = datetime.now(timezone.utc)
                await db.commit()
                await db.refresh(search)

                # Log usage
                log = UsageLog(
                    user_id=search_user_id,
                    action="discover_score",
                    details={
                        "search_id": search_id_str,
                        "raw": len(raw_jobs),
                        "saved": total_saved,
                        "skipped_dup": duplicates_skipped,
                        "skipped_low": low_score_skipped,
                    },
                )
                db.add(log)
                await db.commit()

            except Exception as e:
                await db.rollback()
                logger.error(f"Discovery scoring failed for search {search_id_str}: {e}", exc_info=True)
                continue

    return {
        "scored": total_scored,
        "saved": total_saved,
        "duplicates_skipped": duplicates_skipped,
        "low_score_skipped": low_score_skipped,
    }