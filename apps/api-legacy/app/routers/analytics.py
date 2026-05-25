from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import cast, func, select, Date
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Application, JobListing, UsageLog, User
from app.schemas import DailyStat, DailyStatsResponse, OverviewResponse, StatusCount

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview", response_model=OverviewResponse)
async def overview(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Total applications
    total_apps_result = await db.execute(
        select(func.count(Application.id)).where(Application.user_id == user.id)
    )
    total_apps = total_apps_result.scalar() or 0

    # Total jobs discovered
    total_jobs_result = await db.execute(
        select(func.count(JobListing.id)).where(JobListing.user_id == user.id)
    )
    total_jobs = total_jobs_result.scalar() or 0

    # Counts by status
    status_result = await db.execute(
        select(Application.status, func.count(Application.id))
        .where(Application.user_id == user.id)
        .group_by(Application.status)
    )
    counts = [StatusCount(status=row[0], count=row[1]) for row in status_result.all()]

    submitted = sum(c.count for c in counts if c.status == "submitted")
    success_rate = (submitted / total_apps * 100) if total_apps > 0 else 0.0

    # Platform breakdown
    platform_result = await db.execute(
        select(
            JobListing.platform,
            func.count(Application.id).label("count"),
        )
        .join(Application, Application.job_listing_id == JobListing.id)
        .where(Application.user_id == user.id)
        .group_by(JobListing.platform)
    )
    platform_counts = [
        {"platform": row.platform, "count": row.count}
        for row in platform_result.all()
    ]

    return OverviewResponse(
        total_applications=total_apps,
        total_jobs_discovered=total_jobs,
        counts_by_status=counts,
        success_rate=round(success_rate, 2),
        platform_counts=platform_counts,
    )


@router.get("/daily-stats", response_model=DailyStatsResponse)
async def daily_stats(
    days: int = Query(default=30, ge=1, le=365),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Applications per day
    apps_result = await db.execute(
        select(
            cast(Application.created_at, Date).label("day"),
            func.count(Application.id).label("cnt"),
        )
        .where(Application.user_id == user.id, Application.created_at >= since)
        .group_by("day")
        .order_by("day")
    )
    apps_by_day = {str(row.day): row.cnt for row in apps_result.all()}

    # Job discoveries per day (from usage logs)
    disc_result = await db.execute(
        select(
            cast(UsageLog.created_at, Date).label("day"),
            func.count(UsageLog.id).label("cnt"),
        )
        .where(
            UsageLog.user_id == user.id,
            UsageLog.action == "discover",
            UsageLog.created_at >= since,
        )
        .group_by("day")
        .order_by("day")
    )
    disc_by_day = {str(row.day): row.cnt for row in disc_result.all()}

    # Merge dates
    all_dates = sorted(set(list(apps_by_day.keys()) + list(disc_by_day.keys())))
    stats = [
        DailyStat(
            date=d,
            applications=apps_by_day.get(d, 0),
            discoveries=disc_by_day.get(d, 0),
        )
        for d in all_dates
    ]

    return DailyStatsResponse(stats=stats)
