from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import PortalInboxEvent, User
from app.schemas import PortalInboxEventResponse, StandardRunResponse

router = APIRouter(prefix="/status-sync", tags=["status-sync"])


@router.post("/run", response_model=StandardRunResponse, status_code=status.HTTP_202_ACCEPTED)
async def run_status_sync(
    portal: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a daily status sync for a portal.

    In production this enqueues the ADK status_sync agent.
    """
    run_id = str(uuid.uuid4())
    # TODO: enqueue ADK status_sync agent via ARQ or HTTP call to adk-orchestrator
    return {
        "run_id": run_id,
        "status": "queued",
        "events": [{"step": "status_sync_queued", "portal": portal}],
        "error": None,
    }


@router.get("/inbox-events", response_model=list[PortalInboxEventResponse])
async def list_inbox_events(
    portal: str | None = None,
    unread_only: bool = False,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(PortalInboxEvent).where(PortalInboxEvent.user_id == user.id)
    if portal:
        query = query.where(PortalInboxEvent.portal == portal)
    if unread_only:
        query = query.where(not PortalInboxEvent.read)

    query = query.order_by(PortalInboxEvent.synced_at.desc())
    result = await db.execute(query)
    return result.scalars().all()
