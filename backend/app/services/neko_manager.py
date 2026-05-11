"""Neko cloud browser manager.

Manages ephemeral browser containers for users to log into job portals.
JobBlitz never handles user passwords — only session cookies are captured.
"""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class NekoSession:
    """Represents an active Neko browser session."""
    container_id: str
    user_id: str
    platform: str
    stream_url: str
    token: str
    created_at: datetime
    expires_at: datetime


class NekoManager:
    """Manages Neko Docker containers for cloud browser login.

    Users log into LinkedIn/Naukri through a streamed browser session.
    JobBlitz never receives their password — only session cookies are captured.
    """

    def __init__(self):
        self._client = None

    def _get_client(self):
        """Lazy-load Docker client."""
        if self._client is None:
            import docker
            self._client = docker.from_env()
        return self._client

    async def create_session(self, user_id: str, platform: str) -> NekoSession:
        """Create a Neko container for a user to log into a platform.

        The container auto-destructs after 10 minutes.
        Returns a NekoSession with the iframe URL for the frontend.
        """
        client = self._get_client()
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.NEKO_SESSION_TTL_MINUTES)

        try:
            container = client.containers.run(
                settings.NEKO_IMAGE,
                detach=True,
                remove=True,
                environment={
                    "NEKO_PASSWORD": token,
                    "NEKO_ADMIN_PASSWORD": token + "-admin",
                },
                ports={"8080/tcp": None},
                labels={
                    "jb.user": user_id,
                    "jb.platform": platform,
                    "jb.expires": expires_at.isoformat(),
                },
            )
            container.reload()
            port_bindings = container.ports.get("8080/tcp")
            if port_bindings:
                port = port_bindings[0]["HostPort"]
                host = settings.LOGIN_HOST if hasattr(settings, "LOGIN_HOST") else "localhost"
                stream_url = f"http://{host}:{port}"
            else:
                stream_url = ""

            return NekoSession(
                container_id=container.id,
                user_id=user_id,
                platform=platform,
                stream_url=stream_url,
                token=token,
                created_at=datetime.now(timezone.utc),
                expires_at=expires_at,
            )
        except Exception as e:
            logger.error(f"Failed to create Neko session: {e}", exc_info=True)
            raise

    async def check_login_status(self, container_id: str, platform: str) -> str:
        """Check if the user has successfully logged in.

        Polls the container's browser via CDP to detect when the portal
        dashboard URL is loaded (login success).

        Returns: 'pending', 'success', or 'expired'
        """
        client = self._get_client()
        try:
            container = client.containers.get(container_id)
            expires_str = container.labels.get("jb.expires", "")

            if expires_str:
                expires_at = datetime.fromisoformat(expires_str)
                if datetime.now(timezone.utc) > expires_at.replace(tzinfo=timezone.utc):
                    return "expired"

            # Check if the browser has navigated to a logged-in page
            # This is platform-specific and will be expanded
            platform_indicators = {
                "linkedin": ["linkedin.com/feed", "linkedin.com/in/", "linkedin.com/messaging"],
                "naukri": ["naukri.com/mnaukri", "naukri.com/homepage", "naukri.com/profile"],
            }

            indicators = platform_indicators.get(platform, [])
            # For now, return pending — CDP integration will be added
            return "pending"

        except Exception as e:
            logger.error(f"Failed to check login status for {container_id}: {e}")
            return "expired"

    async def extract_and_store_cookies(self, container_id: str, user_id: str, platform: str) -> None:
        """Extract cookies from the browser session and store them encrypted.

        Uses CDP (Chrome DevTools Protocol) to extract all cookies from
        the browser session. Cookies are encrypted with Fernet and stored
        in the database. The container is destroyed after extraction.
        """
        from app.utils.encryption import encrypt
        from app.database import engine
        from sqlalchemy import select
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
        from app.models import Credential

        _async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        # Extract cookies via CDP (placeholder — will use Playwright CDP)
        cookies_data: list[dict] = []

        try:
            # CDP cookie extraction will be implemented with Playwright
            # For now, we store an empty cookie list as a placeholder
            encrypted_cookies = encrypt(str(cookies_data))

            async with _async_session() as db:
                # Update or create credential record
                result = await db.execute(
                    select(Credential).where(
                        Credential.user_id == user_id,
                        Credential.platform == platform,
                    )
                )
                cred = result.scalar_one_or_none()
                if cred:
                    cred.encrypted_password = encrypted_cookies
                    cred.is_active = True
                    cred.last_login_at = datetime.now(timezone.utc)
                else:
                    cred = Credential(
                        user_id=user_id,
                        platform=platform,
                        username=f"session:{container_id[:8]}",
                        encrypted_password=encrypted_cookies,
                        is_active=True,
                    )
                    db.add(cred)
                await db.commit()

        except Exception as e:
            logger.error(f"Failed to extract/store cookies for {container_id}: {e}", exc_info=True)
            raise

        # Destroy the container after extraction
        await self.destroy_session(container_id)

    async def destroy_session(self, container_id: str) -> None:
        """Kill and remove a Neko container."""
        client = self._get_client()
        try:
            container = client.containers.get(container_id)
            container.kill()
            container.remove(force=True)
            logger.info(f"Destroyed Neko container {container_id[:12]}")
        except Exception as e:
            logger.warning(f"Failed to destroy Neko container {container_id[:12]}: {e}")


# Global singleton
neko_manager = NekoManager()