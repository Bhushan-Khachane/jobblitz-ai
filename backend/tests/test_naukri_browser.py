"""
Verify Naukri can be reached via stealth browser (not blocked by WAF).
Run manually: RUN_BROWSER_TESTS=1 pytest tests/test_naukri_browser.py -v -s
Requires: Docker stack running with browser-worker service.
"""
import pytest
import os
from playwright.async_api import async_playwright

pytestmark = pytest.mark.asyncio


@pytest.mark.skipif(
    not os.getenv("RUN_BROWSER_TESTS"),
    reason="Set RUN_BROWSER_TESTS=1 to run browser tests"
)
async def test_naukri_not_blocked():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-infobars",
                "--disable-dev-shm-usage",
                "--no-first-run",
                "--disable-extensions",
            ]
        )
        ctx = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport={"width": 1366, "height": 768},
            locale="en-IN",
            timezone_id="Asia/Kolkata",
            extra_http_headers={
                "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
            },
        )
        page = await ctx.new_page()
        await page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-IN', 'en'] });
            window.chrome = { runtime: {} };
        """)

        await page.goto("https://www.naukri.com/python-developer-jobs", timeout=30000)
        await page.wait_for_load_state("domcontentloaded")

        title = await page.title()
        content = await page.content()

        await page.screenshot(path=".planning/screenshots/naukri_browser_test.png")
        await browser.close()

        # Must NOT be blocked
        blocked_signals = ["access denied", "403 forbidden", "robot", "captcha", "blocked"]
        for signal in blocked_signals:
            if signal.lower() in title.lower() or signal.lower() in content[:2000].lower():
                pytest.fail(
                    f"Naukri blocked by WAF: {signal} detected in response. "
                    "Add stronger stealth args or residential proxy."
                )

        # Must show job listings
        assert "python" in title.lower() or "naukri" in title.lower(), \
            f"Unexpected page title: {title}"
        print(f"Naukri accessible — title: {title}")
