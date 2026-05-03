from celery import Celery

from app.config import settings

celery_app = Celery(
    "jobblitz",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_soft_time_limit=300,
    task_time_limit=600,
    beat_schedule={
        "discover-jobs-every-2h": {
            "task": "app.workers.tasks.discover_jobs_task",
            "schedule": 7200.0,
        },
        "retry-failed-applications": {
            "task": "app.workers.tasks.retry_failed_task",
            "schedule": 3600.0,
        },
    },
)

celery_app.autodiscover_tasks(["app.workers"])
