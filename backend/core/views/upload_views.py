import os
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

        # Build safe unique filename
        original_name = os.path.basename(file.name)
        safe_name = original_name.replace(' ', '_')
        unique_name = f'{uuid.uuid4().hex}_{safe_name}'
        object_path = f'{folder}/{unique_name}'

        content_type = file.content_type or mimetypes.guess_type(original_name)[0] or 'application/octet-stream'

        upload_url = f'{supabase_url.rstrip("/")}/storage/v1/object/{bucket}/{object_path}'
        headers = {
            'Authorization': f'Bearer {supabase_key}',
            'apikey': supabase_key,
            'Content-Type': content_type,
        }

        # Stream file to Supabase Storage
        try:
            resp = requests.post(upload_url, headers=headers, data=file.read())
        except Exception as exc:
            return Response(
                {'detail': f'Error uploading to storage: {exc}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if resp.status_code not in (200, 201):
            return Response(
                {'detail': 'Upload to storage failed.', 'status_code': resp.status_code},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Public URL for the stored object (bucket must be public in Supabase)
        public_url = f'{supabase_url.rstrip("/")}/storage/v1/object/public/{bucket}/{object_path}'
        return Response({'url': public_url}, status=status.HTTP_201_CREATED)
