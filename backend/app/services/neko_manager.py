"""Neko cloud browser manager.

Manages ephemeral browser containers for users to log into job portals.
JobBlitz never handles user passwords — only session cookies are captured.
"""

from __future__ import annotations

import asyncio
import json
import logging
import secrets
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class NekoSession:
    """Represents an active Neko browser session."""
    container_id: str
    user_id: str
    platform: str
    stream_url: str
    cdp_url: str
    token: str
    created_at: datetime
    expires_at: datetime


class NekoManager:
    """Manages Neko Docker containers for cloud browser login.

    Users log into LinkedIn/Naukri through a streamed browser session.
    JobBlitz never receives their password — only session cookies are captured.
    """

    # URLs that indicate successful login per platform
    PLATFORM_INDICATORS = {
        "linkedin": ["linkedin.com/feed", "linkedin.com/in/", "linkedin.com/messaging"],
        "naukri": ["naukri.com/mnjuser", "naukri.com/homepage", "naukri.com/profile", "naukri.com/mnaukri"],
    }

    # Docker compose network that backend lives on
    COMPOSE_NETWORK = "jobblitz-ai_default"

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
        Returns a NekoSession with the iframe URL and CDP URL.
        """
        client = self._get_client()
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.NEKO_SESSION_TTL_MINUTES)

        try:
            container = await asyncio.to_thread(
                client.containers.run,
                settings.NEKO_IMAGE,
                detach=True,
                remove=True,
                environment={
                    # linuxserver/chromium runs as user abc
                    "PUID": "1000",
                    "PGID": "1000",
                },
                ports={
                    "3000/tcp": None,   # Web UI (selkies) — published to host for browser
                },
                labels={
                    "jb.user": user_id,
                    "jb.platform": platform,
                    "jb.expires": expires_at.isoformat(),
                },
                network=self.COMPOSE_NETWORK,
            )
            await asyncio.to_thread(container.reload)

            # Get port bindings for the web UI (consumed by user's browser outside Docker)
            port_bindings = container.ports.get("3000/tcp")
            public_host = getattr(settings, "NEKO_PUBLIC_HOST", "localhost")

            stream_url = ""
            if port_bindings:
                port = port_bindings[0]["HostPort"]
                stream_url = f"http://{public_host}:{port}"

            # Get the container's IP on the compose network (consumed by backend inside Docker)
            networks = container.attrs.get("NetworkSettings", {}).get("Networks", {})
            network_info = networks.get(self.COMPOSE_NETWORK, {})
            container_ip = network_info.get("IPAddress", "")

            # CDP proxy runs on port 9223 inside the container via socat
            cdp_url = f"http://{container_ip}:9223" if container_ip else ""

            return NekoSession(
                container_id=container.id,
                user_id=user_id,
                platform=platform,
                stream_url=stream_url,
                cdp_url=cdp_url,
                token=token,
                created_at=datetime.now(timezone.utc),
                expires_at=expires_at,
            )
        except Exception as e:
            logger.error(f"Failed to create Neko session: {e}", exc_info=True)
            raise

    async def check_login_status(self, container_id: str, platform: str, cdp_url: str | None = None) -> str:
        """Check if the user has successfully logged in.

        Polls the container's browser via CDP to detect when the portal
        dashboard URL is loaded (login success).

        Args:
            container_id: Docker container ID.
            platform: Platform name (linkedin/naukri).
            cdp_url: Pre-computed CDP endpoint URL. If provided, skips Docker
                     port lookup (faster and works across network boundaries).

        Returns: 'pending', 'success', or 'expired'
        """
        client = self._get_client()
        try:
            # Check container expiry via Docker labels
            if not cdp_url:
                container = await asyncio.to_thread(client.containers.get, container_id)
                expires_str = container.labels.get("jb.expires", "")
                if expires_str:
                    expires_at = datetime.fromisoformat(expires_str)
                    if datetime.now(timezone.utc) > expires_at.replace(tzinfo=timezone.utc):
                        return "expired"

                await asyncio.to_thread(container.reload)
                cdp_bindings = container.ports.get("9223/tcp")
                if not cdp_bindings:
                    return "pending"
                cdp_port = cdp_bindings[0]["HostPort"]
                host = getattr(settings, "LOGIN_HOST", "localhost")
                cdp_url = f"http://{host}:{cdp_port}"

            # Query CDP for current browser pages
            async with httpx.AsyncClient(timeout=5) as http:
                try:
                    resp = await http.get(f"{cdp_url}/json")
                    if resp.status_code == 200:
                        pages = resp.json()
                        if pages:
                            current_url = pages[0].get("url", "")
                            indicators = self.PLATFORM_INDICATORS.get(platform, [])
                            for indicator in indicators:
                                if indicator in current_url:
                                    return "success"
                except (httpx.ConnectError, httpx.TimeoutException, httpx.RemoteProtocolError, json.JSONDecodeError):
                    # CDP not ready yet, container not fully started, or invalid response
                    pass

            return "pending"

        except Exception as e:
            logger.error(f"Failed to check login status for {container_id}: {e}")
            return "expired"

    async def extract_and_store_cookies(self, container_id: str, user_id: str, platform: str, cdp_url: str | None = None) -> None:
        """Extract cookies from the browser session and store them encrypted.

        Connects to the container's browser via Playwright CDP, extracts all
        cookies, encrypts with Fernet, and stores in the Credential table.
        The container is always destroyed after extraction (even on errors).
        """
        from playwright.async_api import async_playwright
        from app.utils.encryption import encrypt
        from app.database import engine
        from sqlalchemy import select
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
        from app.models import Credential

        _async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        try:
            cookies_data: list[dict] = []

            if not cdp_url:
                # Fall back to Docker lookup
                client = self._get_client()
                container = await asyncio.to_thread(client.containers.get, container_id)
                await asyncio.to_thread(container.reload)
                # Validate ownership before extracting anything
                if container.labels.get("jb.user") != user_id:
                    raise PermissionError(
                        f"Container {container_id[:12]} does not belong to user {user_id}"
                    )
                networks = container.attrs.get("NetworkSettings", {}).get("Networks", {})
                network_info = networks.get(self.COMPOSE_NETWORK, {})
                container_ip = network_info.get("IPAddress", "")
                if container_ip:
                    cdp_url = f"http://{container_ip}:9223"

            if cdp_url:
                pw = await async_playwright().start()
                try:
                    browser = await pw.chromium.connect_over_cdp(cdp_url)
                    for ctx in browser.contexts:
                        cookies = await ctx.cookies()
                        cookies_data.extend([
                            {
                                "name": c["name"],
                                "value": c["value"],
                                "domain": c["domain"],
                                "path": c["path"],
                                "expires": c.get("expires", -1),
                            }
                            for c in cookies
                        ])
                    await browser.close()
                finally:
                    await pw.stop()

            if not cookies_data:
                logger.warning(f"No cookies extracted from container {container_id[:12]}")

            # Store encrypted cookies in session_cookies column
            try:
                encrypted_cookies = encrypt(json.dumps(cookies_data))

                async with _async_session() as db:
                    result = await db.execute(
                        select(Credential).where(
                            Credential.user_id == user_id,
                            Credential.platform == platform,
                        )
                    )
                    cred = result.scalar_one_or_none()
                    if cred:
                        cred.session_cookies = encrypted_cookies
                        cred.is_active = True
                        cred.last_login_at = datetime.now(timezone.utc)
                    else:
                        cred = Credential(
                            user_id=user_id,
                            platform=platform,
                            username=f"session:{container_id[:8]}",
                            encrypted_password="neko_session",  # Placeholder — no password-based login
                            session_cookies=encrypted_cookies,
                            is_active=True,
                        )
                        db.add(cred)
                    await db.commit()

            except Exception as e:
                logger.error(f"Failed to store cookies for {container_id}: {e}", exc_info=True)
                raise

        finally:
            # Always destroy the container, even on errors
            await self.destroy_session(container_id)

    async def destroy_session(self, container_id: str) -> None:
        """Kill and remove a Neko container."""
        client = self._get_client()
        try:
            container = await asyncio.to_thread(client.containers.get, container_id)
            await asyncio.to_thread(container.kill)
            await asyncio.to_thread(container.remove, force=True)
            logger.info(f"Destroyed Neko container {container_id[:12]}")
        except Exception as e:
            logger.warning(f"Failed to destroy Neko container {container_id[:12]}: {e}")


# Global singleton
neko_manager = NekoManager()
