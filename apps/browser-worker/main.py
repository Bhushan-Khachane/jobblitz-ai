"""Browser Worker — Execution Plane FastAPI service.

Wraps gstack browse binary calls as HTTP endpoints.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from browser import (
    click,
    console_errors,
    fill,
    goto,
    is_visible,
    links,
    screenshot,
    snapshot,
    status,
    text,
    upload,
)
from session_manager import (
    create_session,
    import_cookies_from_json,
    restore_session,
    start_manual_login,
    verify_session,
)

app = FastAPI(
    title="JobBlitz Browser Worker",
    description="Execution Plane for 3-plane architecture",
    version="1.0.0",
)


# ── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "browser-worker"}


@app.get("/browser/status")
async def browser_status():
    import os
    try:
        output = status()
        return {
            "status": "running",
            "binary": os.getenv("BROWSE_BIN", "unknown"),
            "raw": output
        }
    except Exception as e:
        return {"status": "error", "reason": str(e)}


# ── Request Models ───────────────────────────────────────────────────────────

class GotoRequest(BaseModel):
    url: str
    session_id: str = "default"


class SnapshotRequest(BaseModel):
    session_id: str = "default"
    interactive: bool = True
    diff: bool = False


class TextRequest(BaseModel):
    session_id: str = "default"


class LinksRequest(BaseModel):
    session_id: str = "default"


class FillRequest(BaseModel):
    ref: str
    value: str
    session_id: str = "default"


class ClickRequest(BaseModel):
    ref: str
    session_id: str = "default"


class UploadRequest(BaseModel):
    ref: str
    file_path: str
    session_id: str = "default"


class ScreenshotRequest(BaseModel):
    path: str
    session_id: str = "default"


class IsVisibleRequest(BaseModel):
    selector: str
    session_id: str = "default"


class ConsoleErrorsRequest(BaseModel):
    session_id: str = "default"


class StatusRequest(BaseModel):
    session_id: str = "default"


class ImportCookiesRequest(BaseModel):
    portal: str = Field(pattern="^(naukri|linkedin|indeed)$")
    domain: str
    session_id: str = "default"


class SessionCreateRequest(BaseModel):
    user_id: str
    portal: str = Field(pattern="^(naukri|linkedin|indeed)$")


class SessionVerifyRequest(BaseModel):
    session_id: str
    portal: str = Field(pattern="^(naukri|linkedin|indeed)$")


class SessionStartLoginRequest(BaseModel):
    user_id: str
    portal: str = Field(pattern="^(naukri|linkedin|indeed)$")
    session_id: str


class SessionRestoreRequest(BaseModel):
    session_id: str
    portal: str = Field(pattern="^(naukri|linkedin|indeed)$")


class CookieImportPayload(BaseModel):
    cookies: list[dict]
    portal: str = Field(pattern="^(naukri|linkedin|indeed)$")
    session_id: str


# ── Browser Action Endpoints ─────────────────────────────────────────────────

@app.post("/goto")
async def endpoint_goto(body: GotoRequest):
    try:
        result = goto(body.url)
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/snapshot")
async def endpoint_snapshot(body: SnapshotRequest):
    try:
        result = snapshot(interactive=body.interactive, diff=body.diff)
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/text")
async def endpoint_text(body: TextRequest):
    try:
        result = text()
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/links")
async def endpoint_links(body: LinksRequest):
    try:
        result = links()
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/fill")
async def endpoint_fill(body: FillRequest):
    try:
        result = fill(body.ref, body.value)
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/click")
async def endpoint_click(body: ClickRequest):
    try:
        result = click(body.ref)
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload")
async def endpoint_upload(body: UploadRequest):
    try:
        result = upload(body.ref, body.file_path)
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/screenshot")
async def endpoint_screenshot(body: ScreenshotRequest):
    try:
        result = screenshot(body.path)
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/is_visible")
async def endpoint_is_visible(body: IsVisibleRequest):
    try:
        result = is_visible(body.selector)
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/console_errors")
async def endpoint_console_errors(body: ConsoleErrorsRequest):
    try:
        result = console_errors()
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/status")
async def endpoint_status(body: StatusRequest):
    try:
        result = status()
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/import_cookies")
async def endpoint_import_cookies(body: ImportCookiesRequest):
    from browser import import_cookies

    try:
        result = import_cookies(body.portal, body.domain)
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Session Management Endpoints ───────────────────────────────────────────────

@app.post("/sessions")
async def endpoint_create_session(body: SessionCreateRequest):
    result = create_session(body.user_id, body.portal)
    return {"status": "ok", "result": result}


@app.post("/sessions/start-login")
async def endpoint_start_login(body: SessionStartLoginRequest):
    try:
        result = await start_manual_login(body.user_id, body.portal, body.session_id)
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/sessions/verify")
async def endpoint_verify_session(body: SessionVerifyRequest):
    try:
        result = await verify_session(body.session_id, body.portal)
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/sessions/restore")
async def endpoint_restore_session(body: SessionRestoreRequest):
    try:
        success = await restore_session(body.session_id, body.portal)
        return {"status": "ok", "restored": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/session/import-cookies")
async def endpoint_import_cookies_json(body: CookieImportPayload):
    try:
        result = await import_cookies_from_json(body.cookies, body.portal, body.session_id)
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
