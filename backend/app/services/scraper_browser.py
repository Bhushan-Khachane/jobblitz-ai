"""Persistent browser manager for scraper tasks.

Unlike BrowserPool (which clears cookies on release), scraper contexts
retain cookies/session state between calls — needed for guest search
sessions on LinkedIn and Naukri.
"""

from __future__ import annotations

import logging
import random
from pathlib import Path
from typing import Any

from playwright.async_api import Browser, BrowserContext, Playwright, async_playwright

from app.config import settings
from app.config.proxy import get_proxy

logger = logging.getLogger(__name__)

VIEWPORTS = [
    {"width": 1366, "height": 768},
    {"width": 1440, "height": 900},
    {"width": 1536, "height": 864},
    {"width": 1280, "height": 720},
]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]


class ScraperBrowser:
    """Manages persistent browser contexts for scrapers.

    Contexts are keyed by platform+data_dir and stay alive with their
    cookie state. Closed only on shutdown.
    """

    def __init__(self):
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None
        self._firefox_browser: Any | None = None  # Firefox has no separate Browser type in some versions
        self._contexts: dict[str, BrowserContext] = {}
        self._initialized = False

    async def initialize(self) -> None:
        """Launch the shared browser instances."""
        if self._initialized:
            return

        self._playwright = await async_playwright().start()
        proxy_url = get_proxy("job_discovery", "free")

        # Chromium for LinkedIn
        launch_kwargs: dict[str, Any] = {
            "headless": True,
            "args": [
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
            ],
        }
        if proxy_url:
            launch_kwargs["proxy"] = {"server": proxy_url}

        self._browser = await self._playwright.chromium.launch(**launch_kwargs)

        # Firefox for Naukri (avoids Akamai bot detection)
        firefox_kwargs: dict[str, Any] = {"headless": True}
        if proxy_url:
            firefox_kwargs["proxy"] = {"server": proxy_url}
        self._firefox_browser = await self._playwright.firefox.launch(**firefox_kwargs)

        self._initialized = True
        logger.info("ScraperBrowser initialized (chromium + firefox)")

    async def get_context(self, platform: str, data_dir: str | Path | None = None) -> BrowserContext:
        """Get or create a persistent context for the given platform.

        Contexts are reused across scrape calls (retaining cookies).
        """
        if not self._initialized:
            await self.initialize()

        key = f"{platform}:{data_dir or 'default'}"
        if key in self._contexts:
            return self._contexts[key]

        viewport = random.choice(VIEWPORTS)
        user_agent = random.choice(USER_AGENTS)

        if platform == "naukri":
            context = await self._firefox_browser.new_context(
                viewport=viewport,
                user_agent=user_agent,
            )
        else:
            context = await self._browser.new_context(
                viewport=viewport,
                user_agent=user_agent,
            )

        self._contexts[key] = context
        logger.info(f"Created scraper context for {key}")
        return context

    async def shutdown(self) -> None:
        """Close all contexts and browsers."""
        for key, ctx in self._contexts.items():
            try:
                await ctx.close()
            except Exception as e:
                logger.warning(f"Failed to close scraper context {key}: {e}")
        self._contexts.clear()

        if self._browser:
            await self._browser.close()
        if self._firefox_browser:
            await self._firefox_browser.close()
        if self._playwright:
            await self._playwright.stop()

        self._initialized = False
        logger.info("ScraperBrowser shut down")


# Global singleton
scraper_browser = ScraperBrowser()