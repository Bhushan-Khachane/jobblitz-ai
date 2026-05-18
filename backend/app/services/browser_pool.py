"""Persistent browser pool for Playwright.

Maintains N browser contexts that tasks borrow and return.
No new browser launch per task — contexts are reused with cookie isolation.
"""

from __future__ import annotations

import asyncio
import logging
import random
from typing import Any

from playwright.async_api import Browser, BrowserContext, Playwright, async_playwright

from app.config import get_proxy

logger = logging.getLogger(__name__)

# Viewport sizes for rotation
VIEWPORTS = [
    {"width": 1366, "height": 768},
    {"width": 1440, "height": 900},
    {"width": 1536, "height": 864},
    {"width": 1280, "height": 720},
]

# User agents for rotation
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

STEALTH_INIT_SCRIPT = """
// Patch 1: Hide webdriver flag (most important)
Object.defineProperty(navigator, 'webdriver', {
  get: () => undefined,
  configurable: true
});
// Patch 2: Add plugin array (headless = no plugins)
Object.defineProperty(navigator, 'plugins', {
  get: () => Array.from({length: 5}, (_, i) => ({
    name: ['Chrome PDF Plugin','Chrome PDF Viewer','Native Client','Widevine','Flash'][i]
  }))
});
// Patch 3: Languages (headless defaults to empty)
Object.defineProperty(navigator, 'languages', {
  get: () => ['en-IN', 'en-US', 'en', 'hi']
});
// Patch 4: Add chrome object (headless lacks this)
if (!window.chrome) {
  window.chrome = {
    runtime: { id: undefined },
    loadTimes: function(){},
    csi: function(){},
    app: {}
  };
}
// Patch 5: Randomize canvas fingerprint slightly
const origGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function(type, ...args) {
  const ctx = origGetContext.call(this, type, ...args);
  if (type === '2d' && ctx) {
    const origFillText = ctx.fillText.bind(ctx);
    ctx.fillText = function(text, x, y, ...rest) {
      origFillText(text, x + Math.random() * 0.1, y + Math.random() * 0.1, ...rest);
    };
  }
  return ctx;
};
"""


class BrowserPool:
    """Maintains a pool of persistent browser contexts for reuse.

    Tasks borrow a context, use it, and return it with cookies cleared.
    No new browser is spawned per task.
    """

    def __init__(self, pool_size: int = 3):
        self._pool_size = pool_size
        self._pool: asyncio.Queue[BrowserContext] = asyncio.Queue(maxsize=pool_size)
        self._browser: Browser | None = None
        self._playwright: Playwright | None = None
        self._initialized = False
        self._proxy_url: str | None = None

    async def initialize(self, task_type: str = "discovery", user_tier: str = "free") -> None:
        """Launch the browser and create the context pool."""
        if self._initialized:
            return

        self._playwright = await async_playwright().start()
        self._proxy_url = get_proxy(task_type, user_tier)
        launch_args = [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled",
            "--disable-features=IsolateOrigins,site-per-process",
        ]

        launch_kwargs: dict[str, Any] = {
            "headless": True,
            "args": launch_args,
        }

        self._browser = await self._playwright.chromium.launch(**launch_kwargs)

        for i in range(self._pool_size):
            viewport = VIEWPORTS[i % len(VIEWPORTS)]
            user_agent = USER_AGENTS[i % len(USER_AGENTS)]
            context = await self._browser.new_context(
                viewport=viewport,
                user_agent=user_agent,
                locale="en-IN",
                timezone_id="Asia/Kolkata",
                extra_http_headers={
                    "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
                    "Accept-Encoding": "gzip, deflate, br",
                },
                proxy={"server": self._proxy_url} if self._proxy_url else None,
            )
            await context.add_init_script(STEALTH_INIT_SCRIPT)
            await self._pool.put(context)

        self._initialized = True
        logger.info(f"BrowserPool initialized with {self._pool_size} contexts")

    async def acquire(self, task_type: str = "discovery", user_tier: str = "free") -> BrowserContext:
        """Borrow a browser context from the pool. Returns after 30s timeout."""
        if not self._initialized:
            await self.initialize(task_type, user_tier)

        try:
            ctx = await asyncio.wait_for(self._pool.get(), timeout=30.0)
            logger.debug(f"Acquired browser context (pool remaining: {self._pool.qsize()})")
            return ctx
        except asyncio.TimeoutError:
            logger.warning("Browser pool exhausted — creating temporary context")
            # Fallback: create a temporary context
            viewport = random.choice(VIEWPORTS)
            user_agent = random.choice(USER_AGENTS)
            temp_ctx = await self._browser.new_context(
                viewport=viewport,
                user_agent=user_agent,
                locale="en-IN",
                timezone_id="Asia/Kolkata",
                extra_http_headers={
                    "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
                    "Accept-Encoding": "gzip, deflate, br",
                },
                proxy={"server": self._proxy_url} if self._proxy_url else None,
            )
            await temp_ctx.add_init_script(STEALTH_INIT_SCRIPT)
            return temp_ctx

    async def acquire_for_user(self, user_id: str, task_type: str = "apply", user_tier: str = "free") -> BrowserContext:
        """Create an isolated context with a sticky per-user proxy for fallback applies.

        This context is NOT returned to the shared pool — it is closed after use.
        """
        if not self._initialized:
            await self.initialize(task_type, user_tier)

        from app.services.proxy_service import get_user_proxy
        user_proxy = get_user_proxy(user_id)
        viewport = random.choice(VIEWPORTS)
        user_agent = random.choice(USER_AGENTS)

        ctx_kwargs: dict[str, Any] = {
            "viewport": viewport,
            "user_agent": user_agent,
            "locale": "en-IN",
            "timezone_id": "Asia/Kolkata",
            "extra_http_headers": {
                "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
            },
        }
        if user_proxy:
            ctx_kwargs["proxy"] = user_proxy
            logger.info(f"Using sticky proxy for user={user_id} fallback apply")
        else:
            if self._proxy_url:
                ctx_kwargs["proxy"] = {"server": self._proxy_url}

        ctx = await self._browser.new_context(**ctx_kwargs)
        await ctx.add_init_script(STEALTH_INIT_SCRIPT)
        logger.debug(f"Created isolated context for user={user_id} (task={task_type})")
        return ctx

    def available_count(self) -> int:
        """Return number of available contexts in the pool."""
        return self._pool.qsize()

    async def release(self, ctx: BrowserContext) -> None:
        """Return a browser context to the pool after clearing cookies.

        User-specific contexts (from acquire_for_user) are closed directly
        and NOT returned to the shared pool.
        """
        try:
            await ctx.clear_cookies()
            for page in ctx.pages:
                await page.close()

            try:
                await self._pool.put(ctx)
                logger.debug(f"Released browser context (pool available: {self._pool.qsize()})")
            except asyncio.QueueFull:
                logger.debug("Pool full — closing extra context")
                await ctx.close()
        except Exception as e:
            logger.warning(f"Failed to release browser context: {e}")
            if self._browser:
                try:
                    new_ctx = await self._browser.new_context(
                        viewport=random.choice(VIEWPORTS),
                        user_agent=random.choice(USER_AGENTS),
                        locale="en-IN",
                        timezone_id="Asia/Kolkata",
                        extra_http_headers={
                            "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
                            "Accept-Encoding": "gzip, deflate, br",
                        },
                        proxy={"server": self._proxy_url} if self._proxy_url else None,
                    )
                    await new_ctx.add_init_script(STEALTH_INIT_SCRIPT)
                    await self._pool.put(new_ctx)
                except Exception:
                    logger.error("Failed to create replacement browser context")

    async def shutdown(self) -> None:
        """Close all browser contexts and the browser instance."""
        # Drain and close all pooled contexts
        while not self._pool.empty():
            try:
                ctx = self._pool.get_nowait()
                await ctx.close()
            except Exception:
                pass

        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        self._initialized = False
        logger.info("BrowserPool shut down")


# Global singleton
browser_pool = BrowserPool(pool_size=3)
