from __future__ import annotations

import asyncio
import logging
import uuid
from collections.abc import Mapping
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class CredentialProxy:
    """Thread-safe, TTL, single-use credential vault.

    Stores decrypted credentials keyed by a short-lived session token.
    Tokens expire after 120 seconds and can be retrieved only once.
    Credentials NEVER appear in any prompt string, log line, or LLM message.
    """

    def __init__(self, ttl_seconds: int = 120):
        self._store: dict[str, dict] = {}
        self._lock = asyncio.Lock()
        self._ttl = ttl_seconds

    async def put(
        self,
        user_id: str | uuid.UUID,
        platform: str,
        creds: Mapping[str, str],
    ) -> str:
        """Store credentials and return a session token (UUID4)."""
        token = str(uuid.uuid4())
        async with self._lock:
            self._store[token] = {
                "user_id": str(user_id),
                "platform": platform,
                "creds": dict(creds),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        # Schedule TTL eviction
        asyncio.create_task(self._evict(token, self._ttl))
        logger.info("Credential proxy stored token for user %s platform %s", user_id, platform)
        return token

    def get(self, token: str) -> dict[str, str] | None:
        """Retrieve and **delete** credentials for a token (single-use)."""
        entry = self._store.pop(token, None)
        if entry is None:
            logger.warning("Credential proxy miss for token %s", token)
            return None
        logger.info("Credential proxy consumed token for user %s", entry["user_id"])
        return entry["creds"]

    async def _evict(self, token: str, delay: int) -> None:
        await asyncio.sleep(delay)
        async with self._lock:
            if token in self._store:
                del self._store[token]
                logger.info("Credential proxy TTL expired for token %s", token)

    def size(self) -> int:
        return len(self._store)


credential_proxy = CredentialProxy()
