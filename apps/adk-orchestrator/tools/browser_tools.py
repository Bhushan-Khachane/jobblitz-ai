"""Browser tool declarations for Gemini function calling.

These tools wrap the browser-worker HTTP API so Gemini ADK agents can invoke them.
"""

import os
from typing import Any

import httpx

BROWSER_WORKER_URL = os.getenv("BROWSER_WORKER_URL", "http://localhost:8002")


def _browser_post(endpoint: str, payload: dict) -> str:
    try:
        resp = httpx.post(f"{BROWSER_WORKER_URL}/{endpoint}", json=payload, timeout=30)
        return resp.text
    except Exception as e:
        return f"Error: {str(e)}"


def browser_goto(url: str, session_id: str) -> str:
    """Navigate the persistent browser session to a URL."""
    return _browser_post("goto", {"url": url, "session_id": session_id})


def browser_snapshot(session_id: str, interactive: bool = True, diff: bool = False) -> str:
    """Take a snapshot of the current page. Use interactive=True for fillable forms. Use diff=True to see what changed."""
    return _browser_post("snapshot", {"session_id": session_id, "interactive": interactive, "diff": diff})


def browser_text(session_id: str) -> str:
    """Extract all visible text from the current page."""
    return _browser_post("text", {"session_id": session_id})


def browser_links(session_id: str) -> str:
    """Extract all links from the current page."""
    return _browser_post("links", {"session_id": session_id})


def browser_fill(ref: str, value: str, session_id: str) -> str:
    """Fill an input field identified by ref with value."""
    return _browser_post("fill", {"ref": ref, "value": value, "session_id": session_id})


def browser_click(ref: str, session_id: str) -> str:
    """Click an element identified by ref."""
    return _browser_post("click", {"ref": ref, "session_id": session_id})


def browser_upload(ref: str, file_path: str, session_id: str) -> str:
    """Upload a file to an input identified by ref."""
    return _browser_post("upload", {"ref": ref, "file_path": file_path, "session_id": session_id})


def browser_screenshot(path: str, session_id: str) -> str:
    """Save a screenshot to the given path."""
    return _browser_post("screenshot", {"path": path, "session_id": session_id})


def browser_is_visible(selector: str, session_id: str) -> str:
    """Check if an element matching selector is visible on the page."""
    return _browser_post("is_visible", {"selector": selector, "session_id": session_id})


def browser_console_errors(session_id: str) -> str:
    """Return JavaScript console errors from the current page."""
    return _browser_post("console_errors", {"session_id": session_id})


def browser_status(session_id: str) -> str:
    """Return the current browser session status."""
    return _browser_post("status", {"session_id": session_id})


def browser_import_cookies(portal: str, domain: str, session_id: str) -> str:
    """Import cookies from the browser for a portal domain."""
    return _browser_post("import_cookies", {"portal": portal, "domain": domain, "session_id": session_id})


# Gemini ADK Tool declarations (if using google-adk SDK)
try:
    from google.adk import Tool

    browser_goto_tool = Tool(
        name="browser_goto",
        description="Navigate the persistent browser session to a URL.",
        parameters={"url": {"type": "string", "description": "Full URL to navigate to"}, "session_id": {"type": "string"}},
        function=browser_goto,
    )

    browser_snapshot_tool = Tool(
        name="browser_snapshot",
        description="Take a snapshot of the current page. Use interactive=True for fillable forms. Use diff=True to see what changed.",
        parameters={
            "session_id": {"type": "string"},
            "interactive": {"type": "boolean", "description": "Include interactive elements"},
            "diff": {"type": "boolean", "description": "Show diff from last snapshot"},
        },
        function=browser_snapshot,
    )

    browser_text_tool = Tool(
        name="browser_text",
        description="Extract all visible text from the current page.",
        parameters={"session_id": {"type": "string"}},
        function=browser_text,
    )

    browser_links_tool = Tool(
        name="browser_links",
        description="Extract all links from the current page.",
        parameters={"session_id": {"type": "string"}},
        function=browser_links,
    )

    browser_fill_tool = Tool(
        name="browser_fill",
        description="Fill an input field identified by ref with value.",
        parameters={
            "ref": {"type": "string", "description": "Element reference or selector"},
            "value": {"type": "string", "description": "Value to fill"},
            "session_id": {"type": "string"},
        },
        function=browser_fill,
    )

    browser_click_tool = Tool(
        name="browser_click",
        description="Click an element identified by ref.",
        parameters={
            "ref": {"type": "string", "description": "Element reference or selector"},
            "session_id": {"type": "string"},
        },
        function=browser_click,
    )

    browser_upload_tool = Tool(
        name="browser_upload",
        description="Upload a file to an input identified by ref.",
        parameters={
            "ref": {"type": "string", "description": "Element reference or selector"},
            "file_path": {"type": "string", "description": "Absolute path to file"},
            "session_id": {"type": "string"},
        },
        function=browser_upload,
    )

    browser_screenshot_tool = Tool(
        name="browser_screenshot",
        description="Save a screenshot to the given path.",
        parameters={
            "path": {"type": "string", "description": "File path to save screenshot"},
            "session_id": {"type": "string"},
        },
        function=browser_screenshot,
    )

    browser_is_visible_tool = Tool(
        name="browser_is_visible",
        description="Check if an element matching selector is visible on the page.",
        parameters={
            "selector": {"type": "string", "description": "CSS or text selector"},
            "session_id": {"type": "string"},
        },
        function=browser_is_visible,
    )

    browser_console_errors_tool = Tool(
        name="browser_console_errors",
        description="Return JavaScript console errors from the current page.",
        parameters={"session_id": {"type": "string"}},
        function=browser_console_errors,
    )

    browser_status_tool = Tool(
        name="browser_status",
        description="Return the current browser session status.",
        parameters={"session_id": {"type": "string"}},
        function=browser_status,
    )

    browser_import_cookies_tool = Tool(
        name="browser_import_cookies",
        description="Import cookies from the browser for a portal domain.",
        parameters={
            "portal": {"type": "string", "description": "Portal name"},
            "domain": {"type": "string", "description": "Cookie domain"},
            "session_id": {"type": "string"},
        },
        function=browser_import_cookies,
    )

    ALL_BROWSER_TOOLS = [
        browser_goto_tool,
        browser_snapshot_tool,
        browser_text_tool,
        browser_links_tool,
        browser_fill_tool,
        browser_click_tool,
        browser_upload_tool,
        browser_screenshot_tool,
        browser_is_visible_tool,
        browser_console_errors_tool,
        browser_status_tool,
        browser_import_cookies_tool,
    ]
except ImportError:
    ALL_BROWSER_TOOLS = []
