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
    from browser.playwright_executor import playwright_executor
    await browser_pool.initialize()
    await scraper_browser.initialize()
    ctx["browser_pool"] = browser_pool
    ctx["scraper_browser"] = scraper_browser
    ctx["playwright_executor"] = playwright_executor
    ctx["started"] = True


async def shutdown(ctx: dict) -> None:
    """Clean up resources on worker shutdown."""
    from app.services.browser_pool import browser_pool
    from app.services.scraper_browser import scraper_browser
    from browser.playwright_executor import playwright_executor
    await browser_pool.shutdown()
    await scraper_browser.shutdown()
    await playwright_executor.shutdown()


# Import task functions  # noqa: E402
from app.workers.tasks import (  # noqa: E402
    discover_jobs,
    auto_apply,
    retry_failed,
    notify_user,
    cleanup_old_listings,
    check_application_statuses,
    batch_auto_apply,
    run_discovery_scoring,
)
from app.workers.tasks.cleanup_sessions import cleanup_sessions  # noqa: E402
from app.workers.tasks.followup import run_followup_agent, send_daily_digest  # noqa: E402


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
        run_discovery_scoring,
        run_followup_agent,
        send_daily_digest,
    ]

    cron_jobs = [
        cron(discover_jobs, minute=0, hour={0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22}),  # Every 2 hours
        cron(batch_auto_apply, minute={0, 30}),                                              # Every 30 minutes
        cron(retry_failed, minute=15),                                                       # Every hour at :15
        cron(cleanup_old_listings, hour=2, minute=0),                                        # Daily 2am
        cron(check_application_statuses, hour=3, minute=0),                                 # Daily 3am
        cron(cleanup_sessions, minute={0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55}),     # Every 5 minutes
        cron(run_followup_agent, hour=10, minute=0),                                         # Daily 10am
        cron(send_daily_digest, hour=9, minute=0),                                          # Daily 9am
    ]

    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    max_jobs = 2
    job_timeout = 600
    keep_result = 3600
    retry_jobs = True
    max_tries = 2
    poll_delay = 1.0
    on_startup = startup
    on_shutdown = shutdown