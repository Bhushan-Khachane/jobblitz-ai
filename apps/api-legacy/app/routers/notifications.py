from __future__ import annotations

import asyncio
import json
from typing import AsyncGenerator

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import NotificationPreference, User
from app.schemas import NotificationPreferenceCreate, NotificationPreferenceResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/notifications", tags=["notifications"])


async def get_redis():
    return aioredis.from_url(settings.REDIS_URL, decode_responses=True)


async def sse_stream(user_id: str) -> AsyncGenerator[str, None]:
    r = await get_redis()
    pubsub = r.pubsub()
    await pubsub.subscribe(f"jobblitz:notifications:{user_id}")

    try:
        # Send initial connection event
        yield f"event: connected\ndata: {json.dumps({'userId': user_id, 'timestamp': asyncio.get_event_loop().time()})}\n\n"

        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=25.0)
            if message is None:
                # Heartbeat to keep connection alive
                yield f"event: heartbeat\ndata: {json.dumps({'timestamp': asyncio.get_event_loop().time()})}\n\n"
                continue

            data = message.get("data")
            if data:
                try:
                    payload = json.loads(data) if isinstance(data, str) else data
                    event_type = payload.get("event", "notification")
                    yield f"event: {event_type}\ndata: {json.dumps(payload)}\n\n"
                except (json.JSONDecodeError, TypeError):
                    yield f"event: message\ndata: {json.dumps({'raw': str(data)})}\n\n"
    finally:
        await pubsub.unsubscribe()
        await pubsub.close()
        await r.aclose()


@router.get("/preferences", response_model=NotificationPreferenceResponse | None)
async def get_my_notifications(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's notification preferences."""
    result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == user.id)
    )
    pref = result.scalar_one_or_none()
    if not pref:
        return None
    return pref


@router.put("/preferences", response_model=NotificationPreferenceResponse)
async def upsert_my_notifications(
    body: NotificationPreferenceCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or update notification preferences."""
    result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == user.id)
    )
    pref = result.scalar_one_or_none()

    data = body.model_dump(exclude_unset=True)

    if pref:
        for k, v in data.items():
            setattr(pref, k, v)
    else:
        pref = NotificationPreference(user_id=user.id, **data)
        db.add(pref)

    await db.commit()
    await db.refresh(pref)
    return pref


@router.get("/stream")
async def notifications_stream(user: User = Depends(get_current_user)):
    """SSE stream for real-time notifications."""
    return StreamingResponse(
        sse_stream(str(user.id)),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
