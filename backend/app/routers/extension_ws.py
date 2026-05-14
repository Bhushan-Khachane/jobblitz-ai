"""
WebSocket endpoint for browser extension.
Extension connects here to receive apply instructions and report status.
"""
import json
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.dependencies import decode_token
from app.services.extension_manager import extension_manager  # global singleton

router = APIRouter(prefix="/ws", tags=["websocket"])
logger = logging.getLogger(__name__)


@router.websocket("/extension")
async def extension_websocket(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token")
):
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001, reason="Invalid token")
            return
    except Exception as e:
        logger.warning(f"WS auth failed: {e}")
        await websocket.close(code=4001, reason="Invalid token")
        return

    await extension_manager.connect(str(user_id), websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                continue
            await extension_manager.handle_message(str(user_id), msg)
    except WebSocketDisconnect:
        extension_manager.disconnect(str(user_id))
    except Exception as e:
        logger.error(f"WS error for user {user_id}: {e}")
        extension_manager.disconnect(str(user_id))
