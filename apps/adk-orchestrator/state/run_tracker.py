"""Redis-based run status tracker for ADK agent executions."""
import json
import os
import redis.asyncio as aioredis

_redis_client: aioredis.Redis | None = None

def _get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            os.getenv("REDIS_URL", "redis://redis:6379"),
            decode_responses=True,
        )
    return _redis_client

async def set_run_status(run_id: str, status: str, payload: dict | None = None):
    data = {"status": status}
    if payload:
        data.update(payload)
    await _get_redis().setex(f"run:{run_id}", 7200, json.dumps(data))

async def get_run_status(run_id: str) -> dict:
    data = await _get_redis().get(f"run:{run_id}")
    return json.loads(data) if data else {"status": "not_found"}

async def update_run_progress(run_id: str, step: str, detail: dict | None = None):
    existing = await get_run_status(run_id)
    events = existing.get("events", [])
    events.append({"step": step, **(detail or {})})
    existing["events"] = events
    await _get_redis().setex(f"run:{run_id}", 7200, json.dumps(existing))
