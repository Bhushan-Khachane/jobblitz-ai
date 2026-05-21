from playwright.async_api import async_playwright
import asyncio, json, os, threading, random

_pw = None
_browser = None
_contexts: dict = {}

SESSION_DIR = os.environ.get("SESSION_DIR", "/tmp/browser-worker-sessions")
os.makedirs(SESSION_DIR, exist_ok=True)

_loop = None
_thread = None

VIEWPORTS = [
    {"width": 1366, "height": 768},
    {"width": 1440, "height": 900},
    {"width": 1536, "height": 864},
    {"width": 1280, "height": 720},
]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

STEALTH_INIT_SCRIPT = """
Object.defineProperty(navigator, 'webdriver', {
  get: () => undefined,
  configurable: true
});
Object.defineProperty(navigator, 'plugins', {
  get: () => Array.from({length: 5}, (_, i) => ({
    name: ['Chrome PDF Plugin','Chrome PDF Viewer','Native Client','Widevine','Flash'][i]
  }))
});
Object.defineProperty(navigator, 'languages', {
  get: () => ['en-IN', 'en-US', 'en', 'hi']
});
if (!window.chrome) {
  window.chrome = {
    runtime: { id: undefined },
    loadTimes: function(){},
    csi: function(){},
    app: {}
  };
}
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


def _ensure_loop():
    global _loop, _thread
    if _loop is None:
        _loop = asyncio.new_event_loop()
        _thread = threading.Thread(target=_loop.run_forever, daemon=True)
        _thread.start()


def _run_sync(coro):
    _ensure_loop()
    future = asyncio.run_coroutine_threadsafe(coro, _loop)
    return future.result()


async def _get_page(session_id: str = "default"):
    global _pw, _browser
    if _browser is None:
        _pw = await async_playwright().start()
        launch_args = [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled",
            "--disable-features=IsolateOrigins,site-per-process",
        ]
        _browser = await _pw.chromium.launch(
            headless=os.environ.get("HEADLESS", "true") == "true",
            args=launch_args
        )
    if session_id not in _contexts:
        viewport = random.choice(VIEWPORTS)
        user_agent = random.choice(USER_AGENTS)
        _contexts[session_id] = await _browser.new_context(
            viewport=viewport,
            user_agent=user_agent,
            locale="en-IN",
            timezone_id="Asia/Kolkata",
            extra_http_headers={
                "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
            },
        )
        await _contexts[session_id].add_init_script(STEALTH_INIT_SCRIPT)
    pages = _contexts[session_id].pages
    if not pages:
        page = await _contexts[session_id].new_page()
    else:
        page = pages[-1]
    return page


def goto(url: str, session_id: str = "default") -> str:
    async def _go():
        page = await _get_page(session_id)
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        return page.url
    return _run_sync(_go())


def snapshot(interactive: bool = True, diff: bool = False,
             session_id: str = "default") -> str:
    async def _snap():
        page = await _get_page(session_id)
        return await page.content()
    return _run_sync(_snap())


def text(session_id: str = "default") -> str:
    async def _txt():
        page = await _get_page(session_id)
        return await page.inner_text("body")
    return _run_sync(_txt())


def links(session_id: str = "default") -> list:
    async def _lnk():
        page = await _get_page(session_id)
        return await page.eval_on_selector_all(
            "a[href]", "els => els.map(e => ({text: e.innerText, href: e.href}))"
        )
    return _run_sync(_lnk())


def fill(ref: str, value: str, session_id: str = "default") -> str:
    async def _fill():
        page = await _get_page(session_id)
        await page.fill(ref, value)
        return "ok"
    return _run_sync(_fill())


def click(ref: str, session_id: str = "default") -> str:
    async def _click():
        page = await _get_page(session_id)
        await page.click(ref)
        return "ok"
    return _run_sync(_click())


def upload(ref: str, file_path: str, session_id: str = "default") -> str:
    async def _up():
        page = await _get_page(session_id)
        await page.set_input_files(ref, file_path)
        return "ok"
    return _run_sync(_up())


def screenshot(path: str, session_id: str = "default") -> str:
    async def _shot():
        page = await _get_page(session_id)
        await page.screenshot(path=path, full_page=True)
        return path
    return _run_sync(_shot())


def is_visible(selector: str, session_id: str = "default") -> bool:
    async def _vis():
        page = await _get_page(session_id)
        return await page.is_visible(selector)
    return _run_sync(_vis())


def console_errors(session_id: str = "default") -> list:
    return []


def status() -> str:
    return "playwright-ok"


def import_cookies(portal: str, domain: str,
                   session_id: str = "default") -> str:
    return "use /session/import-cookies endpoint"


def url(session_id: str = "default") -> str:
    async def _url():
        page = await _get_page(session_id)
        return page.url
    return _run_sync(_url())


def handoff(message: str = "", session_id: str = "default") -> str:
    return "handoff not supported in headless mode"


def resume(session_id: str = "default") -> str:
    return "ok"


def state_save(name: str, session_id: str = "default") -> str:
    async def _save():
        page = await _get_page(session_id)
        state = await page.context.storage_state()
        os.makedirs(SESSION_DIR, exist_ok=True)
        path = os.path.join(SESSION_DIR, f"{name}.json")
        with open(path, "w") as f:
            json.dump(state, f)
        return path
    return _run_sync(_save())


def state_load(name: str, session_id: str = "default") -> str:
    async def _load():
        global _contexts, _browser
        state_path = os.path.join(SESSION_DIR, f"{name}.json")
        if not os.path.exists(state_path):
            return "no_state"
        with open(state_path) as f:
            state = json.load(f)
        if session_id in _contexts:
            try:
                await _contexts[session_id].close()
            except Exception:
                pass
            del _contexts[session_id]
        _contexts[session_id] = await _browser.new_context(
            storage_state=state,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/124.0.0.0 Safari/537.36"
        )
        return state_path
    return _run_sync(_load())


def cookie_import_file(cookie_file: str, session_id: str = "default") -> str:
    async def _import():
        with open(cookie_file, "r") as f:
            raw_cookies = json.load(f)

        # Normalize EditThisCookie format to Playwright format
        playwright_cookies = []
        for c in raw_cookies:
            cookie = {
                "name": c.get("name", ""),
                "value": c.get("value", ""),
                "domain": c.get("domain", ""),
                "path": c.get("path", "/"),
                "httpOnly": c.get("httpOnly", False),
                "secure": c.get("secure", False),
            }
            # EditThisCookie uses "expirationDate" (float), playwright uses "expires"
            if "expirationDate" in c:
                cookie["expires"] = int(c["expirationDate"])
            elif "expires" in c:
                cookie["expires"] = int(c["expires"])
            # Skip cookies with empty name or value
            if cookie["name"] and cookie["value"]:
                playwright_cookies.append(cookie)

        if not playwright_cookies:
            return "no_valid_cookies"

        # Get or create context for this session
        page = await _get_page(session_id)
        ctx = page.context
        await ctx.add_cookies(playwright_cookies)
        return f"imported_{len(playwright_cookies)}_cookies"
    return _run_sync(_import())
