"""
Manages WebSocket connections from browser extensions.
Dispatches apply jobs and receives status updates.
"""
import asyncio
import json
import logging
from typing import Dict

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ExtensionManager:
    def __init__(self):
        self.connections: Dict[str, WebSocket] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.connections[str(user_id)] = ws
        logger.info(f"Extension connected: user={user_id}")

    def disconnect(self, user_id: str):
        self.connections.pop(str(user_id), None)
        logger.info(f"Extension disconnected: user={user_id}")

    def is_connected(self, user_id: str) -> bool:
        ws = self.connections.get(str(user_id))
        return ws is not None

    async def send_apply_job(self, user_id: str, payload: dict) -> bool:
        ws = self.connections.get(str(user_id))
        if not ws:
            return False
        try:
            await ws.send_text(json.dumps({"type": "apply_job", **payload}))
            return True
        except Exception as e:
            logger.error(f"Failed to send to extension: {e}")
            self.disconnect(user_id)
            return False

    async def handle_message(self, user_id: str, msg: dict):
        msg_type = msg.get("type")
        if msg_type == "extension_ready":
            logger.info(f"Extension ready: user={user_id}")
        elif msg_type == "apply_status":
            logger.info(f"Apply status from extension user={user_id}: {msg.get('status')} - {msg.get('message')}")


# Global instance
extension_manager = ExtensionManager()
