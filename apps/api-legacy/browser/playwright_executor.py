"""Isolated Playwright scraper execution in subprocesses.

Playwright MUST NOT run inside ARQ's event loop due to asyncio conflicts
with its subprocess IPC transport. We use ProcessPoolExecutor to run each
scraper in a completely separate OS process with its own event loop.
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import hashlib
import logging
import time
from collections import defaultdict
from functools import partial
from typing import Any

logger = logging.getLogger(__name__)


# ── Circuit Breaker ──────────────────────────────────────────────────────────

class ScraperCircuitBreaker:
    """Tracks consecutive failures per scraper.
    Opens circuit after 3 consecutive failures — skips scraper for 30 min.
    """

    def __init__(self, failure_threshold: int = 3, recovery_seconds: int = 1800):
        self.failures: defaultdict[str, int] = defaultdict(int)
        self.open_until: defaultdict[str, float] = defaultdict(float)
        self.threshold = failure_threshold
        self.recovery = recovery_seconds

    def is_open(self, scraper_path: str) -> bool:
        return self.open_until[scraper_path] > time.time()

    def record_failure(self, scraper_path: str) -> None:
        self.failures[scraper_path] += 1
        if self.failures[scraper_path] >= self.threshold:
            self.open_until[scraper_path] = time.time() + self.recovery
            self.failures[scraper_path] = 0
            logger.warning(
                f"Circuit OPEN for {scraper_path} — will skip for {self.recovery}s"
            )

    def record_success(self, scraper_path: str) -> None:
        self.failures[scraper_path] = 0
        self.open_until[scraper_path] = 0.0


circuit_breaker = ScraperCircuitBreaker()


# ── Subprocess entry point ───────────────────────────────────────────────────

def _run_playwright_sync(scraper_fn_path: str, kwargs: dict) -> list[dict]:
    """Entry point for the child process.
    Imports and runs the scraper function in a fresh event loop.
    scraper_fn_path: dotted path e.g. "app.services.scraper_service.scrape_linkedin_jobs"
    """
    import asyncio
    import importlib
    import logging
    import os
    import sys

    # Ensure backend directory is on sys.path (critical for spawn-based multiprocessing)
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    logger = logging.getLogger(__name__)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        module_path, fn_name = scraper_fn_path.rsplit(".", 1)
        module = importlib.import_module(module_path)
        scraper_fn = getattr(module, fn_name)
        logger.info(f"Running scraper {scraper_fn_path} in subprocess PID {os.getpid()}")
        result = loop.run_until_complete(scraper_fn(**kwargs))
        count = len(result) if isinstance(result, list) else 0
        logger.info(f"Scraper {scraper_fn_path} returned {count} jobs in subprocess PID {os.getpid()}")
        # Ensure serialisable output
        if isinstance(result, list):
            return [dict(r) if not isinstance(r, dict) else r for r in result]
        return []
    except Exception as e:
        logger.error(f"Scraper {scraper_fn_path} failed in subprocess PID {os.getpid()}: {e}")
        return []
    finally:
        try:
            from app.services.scraper_browser import scraper_browser
            if scraper_browser._initialized:
                loop.run_until_complete(scraper_browser.shutdown())
        except Exception:
            pass
        try:
            loop.close()
        except Exception:
            pass


# ── Executor wrapper ─────────────────────────────────────────────────────────

class PlaywrightExecutor:
    """Runs Playwright scrapers in isolated subprocesses.
    Safe to call from inside an ARQ worker (or any async context).
    """

    def __init__(self, max_workers: int = 3):
        self._executor = concurrent.futures.ProcessPoolExecutor(max_workers=max_workers)

    async def run_scraper(
        self,
        scraper_fn_path: str,
        timeout_seconds: int = 120,
        **kwargs: Any,
    ) -> list[dict]:
        """Runs a scraper function in a subprocess.
        Returns list of raw job dicts.
        Raises asyncio.TimeoutError if scraper exceeds timeout_seconds.
        """
        if circuit_breaker.is_open(scraper_fn_path):
            logger.warning(f"Circuit open for {scraper_fn_path} — skipping")
            return []

        loop = asyncio.get_event_loop()
        try:
            result = await asyncio.wait_for(
                loop.run_in_executor(
                    self._executor,
                    partial(_run_playwright_sync, scraper_fn_path, kwargs),
                ),
                timeout=timeout_seconds,
            )
            circuit_breaker.record_success(scraper_fn_path)
            return result if result else []
        except asyncio.TimeoutError:
            logger.warning(f"Scraper {scraper_fn_path} timed out after {timeout_seconds}s")
            circuit_breaker.record_failure(scraper_fn_path)
            return []
        except Exception as e:
            logger.error(f"Scraper {scraper_fn_path} failed: {e}")
            circuit_breaker.record_failure(scraper_fn_path)
            return []

    async def shutdown(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)


# Singleton — import this in the worker
playwright_executor = PlaywrightExecutor(max_workers=3)
