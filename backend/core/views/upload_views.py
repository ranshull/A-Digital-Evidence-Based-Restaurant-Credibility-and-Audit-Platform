import os
import re
import uuid
import mimetypes

import requests
from django.conf import settings
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView


ALLOWED_EXTENSIONS = {'pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'}
# Strict limit: 20 MB
MAX_FILE_SIZE = 20 * 1024 * 1024


class FileUploadView(APIView):
    """
    Uploads a file to Supabase Storage 'media' bucket and returns a public URL.

    Files are stored in mime-based folders, e.g. pdf/<filename>, jpg/<filename>.
    """
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        ext = os.path.splitext(file.name)[1].lstrip('.').lower()
        if ext not in ALLOWED_EXTENSIONS:
            return Response(
                {'detail': f'Allowed types: {", ".join(sorted(ALLOWED_EXTENSIONS))}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if file.size > MAX_FILE_SIZE:
            return Response({'detail': 'File too large (max 20MB).'}, status=status.HTTP_400_BAD_REQUEST)

        supabase_url = getattr(settings, 'SUPABASE_URL', None)
        supabase_key = getattr(settings, 'SUPABASE_SERVICE_KEY', None)
        bucket = getattr(settings, 'SUPABASE_MEDIA_BUCKET', 'media')
        if not supabase_url or not supabase_key:
            return Response(
                {'detail': 'Supabase storage is not configured on the server.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Determine folder based on extension (pdf/, jpg/, png/, etc.)
        folder = ext
        if ext in {'jpg', 'jpeg'}:
            folder = 'jpg'

        # Build safe unique filename (Supabase keys allow only safe ASCII)
        original_name = os.path.basename(file.name)
        safe_base = re.sub(r'[^a-zA-Z0-9._-]', '_', original_name)
        safe_base = safe_base.strip('._') or 'file'
        safe_base = safe_base.rsplit('.', 1)[0] if '.' in safe_base else safe_base
        safe_name = f'{safe_base}.{ext}'
        unique_name = f'{uuid.uuid4().hex}_{safe_name}'
        object_path = f'{folder}/{unique_name}'

        content_type = file.content_type or mimetypes.guess_type(original_name)[0] or 'application/octet-stream'

        upload_url = f'{supabase_url.rstrip("/")}/storage/v1/object/{bucket}/{object_path}'
        headers = {
            'Authorization': f'Bearer {supabase_key}',
            'apikey': supabase_key,
            'Content-Type': content_type,
        }

        # Stream file to Supabase Storage (timeout 60s)
        try:
            file_data = file.read()
            resp = requests.post(upload_url, headers=headers, data=file_data, timeout=60)
        except requests.exceptions.Timeout:
            return Response(
                {'detail': 'Upload timed out. Supabase storage did not respond in time.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except requests.exceptions.ConnectionError as exc:
            return Response(
                {'detail': 'Cannot reach Supabase storage. Check SUPABASE_URL and network.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as exc:
            return Response(
                {'detail': f'Error uploading to storage: {type(exc).__name__}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if resp.status_code not in (200, 201):
            try:
                err_body = resp.json()
                msg = err_body.get('message') or err_body.get('error_description') or resp.text[:200]
            except Exception:
                msg = resp.text[:200] if resp.text else f'HTTP {resp.status_code}'
            detail = f'Upload to storage failed: {msg}' if msg else 'Upload to storage failed. Check server SUPABASE_URL and SUPABASE_SERVICE_KEY.'
            return Response(
                {'detail': detail, 'status_code': resp.status_code},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Public URL for the stored object (bucket must be public in Supabase)
        public_url = f'{supabase_url.rstrip("/")}/storage/v1/object/public/{bucket}/{object_path}'
        return Response({'url': public_url}, status=status.HTTP_201_CREATED)
