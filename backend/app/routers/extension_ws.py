"""
WebSocket endpoint for browser extension.
Extension connects here to receive apply instructions and report status.
"""
import asyncio
import json
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.dependencies import decode_token
from app.services.extension_manager import ExtensionManager

router = APIRouter(prefix="/ws", tags=["websocket"])
logger = logging.getLogger(__name__)
manager = ExtensionManager()


@router.websocket("/extension")
async def extension_websocket(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token")
):
    user = None
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

    await manager.connect(str(user_id), websocket)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            await manager.handle_message(str(user_id), msg)
    except WebSocketDisconnect:
        manager.disconnect(str(user_id))
    except Exception as e:
        logger.error(f"WS error for user {user_id}: {e}")
        manager.disconnect(str(user_id))
