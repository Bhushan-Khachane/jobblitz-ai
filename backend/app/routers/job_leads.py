from __future__ import annotations

import hashlib
import uuid
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import JobLead, User

router = APIRouter(prefix="/job-leads", tags=["job-leads"])


class JobLeadItem(BaseModel):
    title: str
    company: str = ""
    location: str = ""
    description: str = ""
    url: str | None = None
    salary: str = ""
    source: str = ""
    posted_at: str = ""
    portal: str = ""
    search_profile_id: str | None = None


class BulkJobLeadsRequest(BaseModel):
    user_id: str
    portal: str
    leads: list[JobLeadItem]


class BulkJobLeadsResponse(BaseModel):
    inserted: int
    skipped: int


@router.post("/bulk", response_model=BulkJobLeadsResponse)
async def bulk_upsert_job_leads(
    body: BulkJobLeadsRequest,
    db: AsyncSession = Depends(get_db),
):
    """Bulk insert job leads with deduplication by normalized hash."""
    inserted = 0
    skipped = 0

    try:
        user_uuid = uuid.UUID(body.user_id)
    except ValueError:
        # If user_id is not a valid UUID, skip all
        return {"inserted": 0, "skipped": len(body.leads)}

    for lead in body.leads:
        try:
            url = (lead.url or "").strip()
            if not url:
                skipped += 1
                continue

            # Check for existing lead by (url, user_id)
            result = await db.execute(
                select(JobLead).where(
                    JobLead.url == url,
                    JobLead.user_id == user_uuid,
                )
            )
            if result.scalar_one_or_none():
                skipped += 1
                continue

            # Parse optional search_profile_id
            search_profile_id = None
            if lead.search_profile_id:
                try:
                    search_profile_id = uuid.UUID(lead.search_profile_id)
                except ValueError:
                    pass

            db_lead = JobLead(
                user_id=user_uuid,
                search_profile_id=search_profile_id,
                portal=lead.portal or body.portal,
                url=url,
                title=lead.title or "",
                company=lead.company or "",
                location=lead.location or None,
                jd_text=lead.description or None,
                posted_at=lead.posted_at or None,
                raw_data={
                    "salary": lead.salary,
                    "source": lead.source,
                    "portal": lead.portal,
                },
            )
            db.add(db_lead)
            inserted += 1
        except Exception:
            skipped += 1

    await db.commit()
    return {"inserted": inserted, "skipped": skipped}
