import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import Application, JobListing
from app.services.agent_dispatcher import dispatch_apply

logger = logging.getLogger(__name__)


async def auto_apply(
    ctx: dict,
    user_id: str,
    job_listing_id: str,
    resume_id: str | None = None,
):
    """ARQ task: dispatch approved application to ADK apply agent."""
    logger.info(f"[auto_apply] user={user_id} listing={job_listing_id}")
    async with AsyncSessionLocal() as db:
        # Load application
        uid = uuid.UUID(user_id)
        lid = uuid.UUID(job_listing_id)
        result = await db.execute(
            select(Application).where(
                Application.user_id == uid,
                Application.job_listing_id == lid,
            )
        )
        app = result.scalar_one_or_none()
        if not app:
            logger.error("[auto_apply] Application not found")
            return {"status": "error", "reason": "application_not_found"}

        # Build plan payload
        listing_result = await db.execute(
            select(JobListing).where(JobListing.id == lid)
        )
        listing = listing_result.scalar_one_or_none()

        plan_payload = {
            "user_id": user_id,
            "job_listing_id": job_listing_id,
            "resume_id": resume_id,
            "apply_url": listing.apply_url if listing else "",
            "platform": listing.platform if listing else "naukri",
            "title": listing.title if listing else "",
            "company": listing.company if listing else "",
            "fields": [],
        }

        result = await dispatch_apply(
            user_id=user_id,
            application_plan_id=str(app.id),
            plan_payload=plan_payload,
            run_id=str(app.id),
        )

        # Update application status
        if result.get("status") == "error":
            app.status = "failed"
            app.error_message = result.get("error", "Unknown error")
            app.retry_count = (app.retry_count or 0) + 1
        else:
            app.status = "submitted"
            app.applied_at = datetime.now(timezone.utc)

        await db.commit()
        return result


# ARQ WorkerSettings — register the task
class WorkerSettings:
    functions = [auto_apply]
    redis_settings = None  # set at startup from env
