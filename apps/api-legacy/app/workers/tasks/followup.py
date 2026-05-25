"""Follow-up agent and daily digest ARQ tasks."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.database import engine
from app.models import Application, JobListing, NotificationPreference, User
from app.services.email_service import (
    daily_digest_template,
    follow_up_email_template,
    send_email,
)

import logging

logger = logging.getLogger(__name__)

_async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def run_followup_agent(ctx: dict) -> dict:
    """Send follow-up emails for submitted applications with no response after 7 days.
    Respects user notification preferences and max 3 follow-ups per application.
    """
    sent = 0
    skipped = 0
    failed = 0

    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    async with _async_session() as db:
        # Find submitted applications with no update for 7+ days
        result = await db.execute(
            select(Application, JobListing, User)
            .join(JobListing, Application.job_listing_id == JobListing.id)
            .join(User, Application.user_id == User.id)
            .where(
                Application.status == "submitted",
                Application.applied_at < seven_days_ago,
                Application.follow_up_count < 3,
                Application.follow_up_status != "sent",
            )
        )
        rows = result.all()

        for app, job, user in rows:
            # Check user notification preferences
            pref_result = await db.execute(
                select(NotificationPreference).where(
                    NotificationPreference.user_id == user.id
                )
            )
            pref = pref_result.scalar_one_or_none()
            if pref and not pref.email_notifications:
                skipped += 1
                continue
            if pref and not pref.follow_up_enabled:
                skipped += 1
                continue

            applied_date = app.applied_at.strftime("%b %d, %Y") if app.applied_at else "recently"
            html = follow_up_email_template(
                full_name=user.full_name,
                company=job.company,
                job_title=job.title,
                applied_date=applied_date,
            )
            resp = await send_email(
                to=user.email,
                subject=f"Follow-up: {job.title} at {job.company}",
                html=html,
            )

            if resp.get("sent"):
                app.follow_up_email_sent_at = datetime.now(timezone.utc)
                app.follow_up_status = "sent"
                app.follow_up_count += 1
                app.last_contact_at = datetime.now(timezone.utc)
                sent += 1
            else:
                app.follow_up_status = "failed"
                failed += 1

        await db.commit()

    logger.info(f"Follow-up agent: sent={sent}, skipped={skipped}, failed={failed}")
    return {"sent": sent, "skipped": skipped, "failed": failed}


async def send_daily_digest(ctx: dict) -> dict:
    """Send daily digest emails to users with digest_frequency = 'daily'.
    Summarizes new jobs discovered, applications submitted, and pending approvals.
    """
    sent = 0
    skipped = 0
    failed = 0

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)

    async with _async_session() as db:
        # Users with daily digest enabled
        pref_result = await db.execute(
            select(NotificationPreference, User)
            .join(User, NotificationPreference.user_id == User.id)
            .where(
                NotificationPreference.email_notifications.is_(True),
                NotificationPreference.digest_frequency == "daily",
            )
        )
        users_with_digest = pref_result.all()

        for pref, user in users_with_digest:
            uid = user.id

            # Count new jobs discovered in last 24h
            jobs_result = await db.execute(
                select(func.count()).where(
                    JobListing.user_id == uid,
                    JobListing.created_at >= yesterday_start,
                )
            )
            new_jobs = jobs_result.scalar() or 0

            # Count applications submitted today
            apps_result = await db.execute(
                select(func.count()).where(
                    Application.user_id == uid,
                    Application.applied_at >= yesterday_start,
                )
            )
            apps_today = apps_result.scalar() or 0

            # Count pending approvals
            pending_result = await db.execute(
                select(func.count()).where(
                    Application.user_id == uid,
                    Application.approval_status == "pending_approval",
                )
            )
            pending_approvals = pending_result.scalar() or 0

            # Average match score for today's jobs
            score_result = await db.execute(
                select(func.coalesce(func.avg(JobListing.match_score), 0)).where(
                    JobListing.user_id == uid,
                    JobListing.created_at >= yesterday_start,
                )
            )
            avg_score = int((score_result.scalar() or 0) * 100)

            html = daily_digest_template(
                full_name=user.full_name,
                new_jobs=new_jobs,
                applications_today=apps_today,
                pending_approvals=pending_approvals,
                avg_match_score=avg_score,
            )
            resp = await send_email(
                to=user.email,
                subject="Your JobBlitz Daily Digest",
                html=html,
            )

            if resp.get("sent"):
                sent += 1
            else:
                failed += 1

    logger.info(f"Daily digest: sent={sent}, skipped={skipped}")
    return {"sent": sent, "skipped": skipped}
