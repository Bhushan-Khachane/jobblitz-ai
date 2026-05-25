"""ARQ cron task: Destroy Neko containers that have exceeded their 10-minute TTL."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def cleanup_sessions(ctx: dict) -> dict:
    """Destroy Neko containers older than 10 minutes.

    Runs every 5 minutes via ARQ cron.
    Checks container labels for jb.user and jb.expires.
    Kills any container past its expiration time.
    """
    destroyed = 0

    try:
        import docker

        client = docker.from_env()
        containers = client.containers.list(filters={"label": "jb.user"})

        for container in containers:
            expires_str = container.labels.get("jb.expires")
            if not expires_str:
                continue

            try:
                expires_at = datetime.fromisoformat(expires_str)
                if datetime.now(timezone.utc) > expires_at.replace(tzinfo=timezone.utc):
                    user_id = container.labels.get("jb.user", "unknown")
                    platform = container.labels.get("jb.platform", "unknown")
                    container.kill()
                    container.remove(force=True)
                    logger.info(f"Destroyed expired Neko container for user={user_id} platform={platform}")
                    destroyed += 1
            except (ValueError, Exception) as e:
                logger.warning(f"Failed to process container {container.id}: {e}")
                continue

    except Exception as e:
        logger.error(f"Cleanup sessions failed: {e}", exc_info=True)

    return {"destroyed": destroyed}