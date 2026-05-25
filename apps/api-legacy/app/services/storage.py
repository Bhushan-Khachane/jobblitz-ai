"""Supabase Storage upload helper with local fallback.

Uploads files (screenshots, resumes) to Supabase Storage when configured.
Falls back to local filesystem paths when Supabase is not available.
"""

from __future__ import annotations

import logging
from pathlib import Path

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def upload_to_storage(local_path: str, user_id: str, filename: str) -> str | None:
    """Upload a file to Supabase Storage.

    Returns the public URL on success, or None if Supabase is not configured
    or the upload fails (caller should use local path as fallback).
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        logger.debug("Supabase Storage not configured, skipping upload")
        return None

    file_path = Path(local_path)
    if not file_path.exists():
        logger.warning(f"File not found for upload: {local_path}")
        return None

    bucket = settings.SUPABASE_BUCKET_NAME
    storage_path = f"{user_id}/{filename}"
    base_url = settings.SUPABASE_URL.rstrip("/")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            # Upload to Supabase Storage
            with open(file_path, "rb") as f:
                resp = await client.post(
                    f"{base_url}/storage/v1/object/{bucket}/{storage_path}",
                    content=f.read(),
                    headers={
                        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                        "Content-Type": "image/png",
                    },
                )

            if resp.status_code in (200, 201):
                public_url = f"{base_url}/storage/v1/object/public/{bucket}/{storage_path}"
                logger.info(f"Uploaded {filename} to Supabase Storage: {public_url}")
                return public_url
            else:
                logger.warning(f"Supabase Storage upload failed ({resp.status_code}): {resp.text}")
                return None

    except Exception as e:
        logger.warning(f"Supabase Storage upload error: {e}")
        return None