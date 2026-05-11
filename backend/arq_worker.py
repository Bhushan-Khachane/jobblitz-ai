"""ARQ worker configuration.

Replaces Celery with native async task queue.
All tasks are async functions — no asyncio.run() anti-pattern.
"""

from arq import cron
from arq.connections import RedisSettings

from app.config import settings


async def startup(ctx: dict) -> None:
    """Initialize resources on worker startup."""
    from app.services.browser_pool import browser_pool
    from app.services.scraper_browser import scraper_browser
    await browser_pool.initialize()
    await scraper_browser.initialize()
    ctx["browser_pool"] = browser_pool
    ctx["scraper_browser"] = scraper_browser
    ctx["started"] = True


async def shutdown(ctx: dict) -> None:
    """Clean up resources on worker shutdown."""
    from app.services.browser_pool import browser_pool
    from app.services.scraper_browser import scraper_browser
    await browser_pool.shutdown()
    await scraper_browser.shutdown()


# Import task functions
from app.workers.tasks import (
    discover_jobs,
    auto_apply,
    retry_failed,
    notify_user,
    cleanup_old_listings,
    check_application_statuses,
    batch_auto_apply,
)
from app.workers.tasks.cleanup_sessions import cleanup_sessions


class WorkerSettings:
    """ARQ worker settings. Run with: arq arq_worker.WorkerSettings"""

    functions = [
        discover_jobs,
        auto_apply,
        retry_failed,
        notify_user,
        cleanup_old_listings,
        check_application_statuses,
        batch_auto_apply,
        cleanup_sessions,
    ]

    cron_jobs = [
        cron(discover_jobs, minute=0, hour="*/2"),       # Every 2 hours
        cron(batch_auto_apply, minute="*/30"),            # Every 30 minutes
        cron(retry_failed, minute=15, hour="*/1"),       # Every hour at :15
        cron(cleanup_old_listings, hour=2, minute=0),     # Weekly Sunday 2am (day_of_week=0)
        cron(check_application_statuses, hour=9, minute=0),  # Daily 9am
        cron(cleanup_sessions, minute="*/5"),             # Every 5 minutes
    ]

    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    max_jobs = 20
    job_timeout = 300
    keep_result = 600
    retry_jobs = True
    max_tries = 3
    on_startup = startup
    on_shutdown = shutdown