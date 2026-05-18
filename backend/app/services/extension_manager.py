"""
Manages WebSocket connections from browser extensions.
Dispatches apply jobs and receives status updates.
"""
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
        logger.info(f"Extension connected: user={user_id}. Active connections: {len(self.connections)}")

    def disconnect(self, user_id: str):
        self.connections.pop(str(user_id), None)
        logger.info(f"Extension disconnected: user={user_id}. Active: {len(self.connections)}")

    def is_connected(self, user_id: str) -> bool:
        return str(user_id) in self.connections

    async def send_apply_job(self, user_id: str, payload: dict) -> bool:
        ws = self.connections.get(str(user_id))
        if not ws:
            return False
        try:
            await ws.send_text(json.dumps({"type": "apply_job", **payload}))
            return True
        except Exception as e:
            logger.error(f"Failed to send to extension user={user_id}: {e}")
            self.disconnect(user_id)
            return False

    async def handle_message(self, user_id: str, msg: dict):
        msg_type = msg.get("type")
        if msg_type == "extension_ready":
            logger.info(f"Extension ready: user={user_id}")
        elif msg_type == "apply_status":
            await self._update_application_status(
                app_id=msg.get("application_id"),
                status=msg.get("status"),
                message=msg.get("message", ""),
            )
        else:
            logger.debug(f"Unknown message type from extension: {msg_type}")

    async def _update_application_status(
        self, app_id: str | None, status: str | None, message: str
    ) -> None:
        """Write extension apply result back to the Application table."""
        if not app_id or not status:
            logger.warning(f"Received apply_status with missing app_id or status: app_id={app_id}")
            return

        # Map extension statuses to valid Application model status values
        # Valid DB statuses: pending / approved / submitted / failed / interview / rejected / accepted / skipped
        STATUS_MAP = {
            "applied":      "submitted",
            "failed":       "failed",
            "rate_limited": "pending",
            "skipped":      "skipped",
            "error":        "failed",
            "starting":     "pending",
        }
        db_status = STATUS_MAP.get(status, "pending")

        try:
            from app.database import async_session
            from app.models import Application
            from sqlalchemy import select

            async with async_session() as db:
                result = await db.execute(select(Application).where(Application.id == app_id))
                app = result.scalar_one_or_none()
                if app:
                    app.status = db_status
                    if db_status in ("failed", "skipped") and message:
                        app.error_message = message[:500]
                    await db.commit()
                    logger.info(f"Application {app_id} status → {db_status} (from extension)")
                else:
                    logger.warning(f"Application {app_id} not found in DB — cannot update status")
        except Exception as e:
            logger.error(f"DB status update failed for app_id={app_id}: {e}", exc_info=True)


# Global singleton — import THIS, not the class
extension_manager = ExtensionManager()
