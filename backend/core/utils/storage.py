"""Upload file to Supabase Storage; returns public URL or raises."""
import os
import re
import uuid
import mimetypes

import requests
from django.conf import settings


def _sanitize_object_name(name: str) -> str:
    """
    Sanitize filename for use in storage object keys.
    Supabase/S3 reject keys with [ ] and other special chars.
    """
    base = os.path.basename(name)
    # Keep only alphanumeric, dash, underscore, dot; replace rest with underscore
    safe = re.sub(r'[^\w\-.]', '_', base, flags=re.IGNORECASE)
    return safe or 'file'


def upload_to_supabase(file, object_path_prefix):
    """
    Upload file to Supabase media bucket. object_path_prefix is e.g. 'evidence/5'.
    Returns (public_url, content_type).
    """
    supabase_url = getattr(settings, 'SUPABASE_URL', None)
    supabase_key = getattr(settings, 'SUPABASE_SERVICE_KEY', None)
    bucket = getattr(settings, 'SUPABASE_MEDIA_BUCKET', 'media')
    if not supabase_url or not supabase_key:
        raise ValueError('Supabase storage is not configured.')

    original_name = os.path.basename(file.name)
    safe_name = _sanitize_object_name(original_name)
    unique_name = f'{uuid.uuid4().hex}_{safe_name}'
    object_path = f'{object_path_prefix}/{unique_name}'
    content_type = file.content_type or mimetypes.guess_type(original_name)[0] or 'application/octet-stream'

    upload_url = f'{supabase_url.rstrip("/")}/storage/v1/object/{bucket}/{object_path}'
    headers = {
        'Authorization': f'Bearer {supabase_key}',
        'apikey': supabase_key,
        'Content-Type': content_type,
    }
    resp = requests.post(upload_url, headers=headers, data=file.read())
    if resp.status_code not in (200, 201):
        try:
            err_body = (resp.text or resp.reason or '')[:500]
        except Exception:
            err_body = ''
        msg = f'Upload failed: {resp.status_code}'
        if err_body:
            msg = f'{msg} — {err_body}'
        raise RuntimeError(msg)

    public_url = f'{supabase_url.rstrip("/")}/storage/v1/object/public/{bucket}/{object_path}'
    return public_url, content_type
