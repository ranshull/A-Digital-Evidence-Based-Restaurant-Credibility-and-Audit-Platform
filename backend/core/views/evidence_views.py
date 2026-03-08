import os
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied

from ..models import Evidence, EvidenceFileType, EvidenceStatus, RubricCategory, Restaurant, EvidenceTimestamp
from ..serializers import EvidenceSerializer, EvidenceUploadSerializer
from ..permissions import IsOwnerWithRestaurant, IsAdminOrAuditor
from ..utils.storage import upload_to_supabase
from ..crypto.hash_chain import add_evidence_to_chain, update_chain_after_append, verify_hash_chain
from ..crypto.timestamps import create_timestamp_token, verify_timestamp_token, detect_backdating_attempt
from ..crypto.merkle import build_merkle_tree
from ..crypto.tamper import run_initial_forensics, verify_file_integrity, detect_metadata_tampering


# Evidence upload: JPEG, PNG, MP4 only; max 50MB per file; max 5 files
EVIDENCE_ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'mp4'}
EVIDENCE_MAX_FILE_SIZE = 50 * 1024 * 1024
EVIDENCE_MAX_FILES = 5

EXT_TO_FILE_TYPE = {
    'jpg': EvidenceFileType.IMAGE,
    'jpeg': EvidenceFileType.IMAGE,
    'png': EvidenceFileType.IMAGE,
    'mp4': EvidenceFileType.VIDEO,
}


class EvidenceUploadView(APIView):
    """Owner: upload evidence files (multipart: category_id, description, files)."""
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated, IsOwnerWithRestaurant]

    def post(self, request):
        restaurant = request.user.restaurant
        category_id = request.data.get('category_id')
        description = (request.data.get('description') or '').strip()

        if not category_id:
            return Response({'detail': 'category_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            category = RubricCategory.objects.get(pk=category_id, is_active=True)
        except RubricCategory.DoesNotExist:
            return Response({'detail': 'Invalid or inactive category.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(description) < 20:
            return Response(
                {'detail': 'Description must be at least 20 characters.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Collect file fields (multiple keys "files" or "file")
        files = []
        for key in list(request.FILES.keys()):
            f = request.FILES.get(key)
            if f:
                files.append(f)
        if not files:
            return Response({'detail': 'At least one file is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(files) > EVIDENCE_MAX_FILES:
            return Response(
                {'detail': f'Maximum {EVIDENCE_MAX_FILES} files per upload.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prefix = f'evidence/{restaurant.id}'
        created = []
        for f in files:
            ext = os.path.splitext(f.name)[1].lstrip('.').lower()
            if ext not in EVIDENCE_ALLOWED_EXTENSIONS:
                return Response(
                    {'detail': f'Allowed types: JPEG, PNG, MP4. Got: {ext}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if f.size > EVIDENCE_MAX_FILE_SIZE:
                return Response(
                    {'detail': 'File exceeds 50MB limit.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            content = f.read()
            metadata = {
                'timestamp': timezone.now().isoformat(),
                'owner_id': request.user.id,
                'category': category.name,
                'filename': os.path.basename(f.name),
            }
            try:
                hash_data = add_evidence_to_chain(restaurant.id, content, metadata)
            except Exception:
                return Response(
                    {'detail': 'Hash chain computation failed.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            file_like = SimpleUploadedFile(
                f.name,
                content,
                content_type=getattr(f, 'content_type', None),
            )
            try:
                public_url, mime_type = upload_to_supabase(file_like, prefix)
            except ValueError as e:
                return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            except RuntimeError as e:
                return Response(
                    {'detail': str(e) or 'Upload to storage failed.'},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            file_type = EXT_TO_FILE_TYPE.get(ext, EvidenceFileType.IMAGE)
            evidence = Evidence.objects.create(
                restaurant=restaurant,
                uploaded_by=request.user,
                category=category,
                file_url=public_url,
                file_type=file_type,
                original_filename=os.path.basename(f.name),
                file_size_bytes=len(content),
                mime_type=mime_type,
                description=description,
                status=EvidenceStatus.PENDING,
                hash_value=hash_data['hash_value'],
                previous_hash=hash_data['previous_hash'],
                chain_index=hash_data['chain_index'],
                nonce=hash_data['nonce'],
                file_content_hash=hash_data['file_content_hash'],
                is_chain_valid=True,
            )
            update_chain_after_append(restaurant.id, hash_data['hash_value'])
            token = create_timestamp_token(evidence.id, hash_data['hash_value'])
            EvidenceTimestamp.objects.create(
                evidence=evidence,
                timestamp_token=token,
                server_time=timezone.now(),
                hash_at_timestamp=hash_data['hash_value'],
                is_verified=True,
            )
            try:
                build_merkle_tree(restaurant.id)
            except Exception:
                pass
            try:
                run_initial_forensics(evidence.id)
            except Exception:
                pass
            created.append(evidence)

        serializer = EvidenceSerializer(created, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MyRestaurantEvidenceListView(generics.ListAPIView):
    """Owner: list evidence for their restaurant."""
    serializer_class = EvidenceSerializer
    permission_classes = [IsAuthenticated, IsOwnerWithRestaurant]

    def get_queryset(self):
        qs = Evidence.objects.filter(
            restaurant=self.request.user.restaurant
        ).select_related('category').order_by('-upload_timestamp')
        status_filter = self.request.query_params.get('status', '').strip()
        category_id = self.request.query_params.get('category_id', '').strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        if category_id:
            try:
                qs = qs.filter(category_id=int(category_id))
            except ValueError:
                pass
        return qs


class EvidenceDetailView(generics.RetrieveAPIView):
    """Admin/Auditor/Super Admin: retrieve single evidence (for detail view and crypto actions)."""
    serializer_class = EvidenceSerializer
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]
    queryset = Evidence.objects.select_related('restaurant', 'category', 'uploaded_by')


class EvidenceDeleteView(generics.DestroyAPIView):
    """Owner: delete pending evidence for their restaurant."""
    permission_classes = [IsAuthenticated, IsOwnerWithRestaurant]

    def get_queryset(self):
        return Evidence.objects.filter(
            restaurant__owner=self.request.user,
            status=EvidenceStatus.PENDING,
        )


class PendingEvidenceListView(generics.ListAPIView):
    """Admin/Auditor: list evidence with filters (pending queue)."""
    serializer_class = EvidenceSerializer
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def get_queryset(self):
        qs = Evidence.objects.select_related(
            'restaurant', 'category', 'uploaded_by'
        ).order_by('-upload_timestamp')
        restaurant_id = self.request.query_params.get('restaurant_id', '').strip()
        category_id = self.request.query_params.get('category_id', '').strip()
        status_filter = self.request.query_params.get('status', '').strip()
        date_from = self.request.query_params.get('date_from', '').strip()
        date_to = self.request.query_params.get('date_to', '').strip()
        if restaurant_id:
            try:
                qs = qs.filter(restaurant_id=int(restaurant_id))
            except ValueError:
                pass
        if category_id:
            try:
                qs = qs.filter(category_id=int(category_id))
            except ValueError:
                pass
        if status_filter:
            qs = qs.filter(status=status_filter)
        if date_from:
            qs = qs.filter(upload_timestamp__date__gte=date_from)
        if date_to:
            qs = qs.filter(upload_timestamp__date__lte=date_to)
        return qs


def _can_access_assigned_restaurant(request, restaurant):
    """Allow if restaurant is unassigned, assigned to request.user, or request.user is Super Admin."""
    if not restaurant.review_assigned_to_id:
        return True
    if request.user.role == 'SUPER_ADMIN':
        return True
    return restaurant.review_assigned_to_id == request.user.id


class RestaurantEvidenceListView(generics.ListAPIView):
    """Admin/Auditor: list evidence for a specific restaurant (only if assigned to you or unassigned)."""
    serializer_class = EvidenceSerializer
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def get_queryset(self):
        pk = self.kwargs.get('pk')
        restaurant = get_object_or_404(Restaurant, pk=pk)
        if not _can_access_assigned_restaurant(self.request, restaurant):
            raise PermissionDenied('This work is assigned to another user. Only they or Super Admin can access it.')
        qs = Evidence.objects.filter(restaurant_id=pk).select_related(
            'restaurant', 'category', 'uploaded_by'
        ).order_by('-upload_timestamp')
        status_filter = self.request.query_params.get('status', '').strip()
        category_id = self.request.query_params.get('category_id', '').strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        if category_id:
            try:
                qs = qs.filter(category_id=int(category_id))
            except ValueError:
                pass
        return qs


def _run_crypto_verification(evidence):
    """Run Phase 2 crypto checks; return (all_passed: bool, failure_reasons: list)."""
    reasons = []
    integrity = verify_file_integrity(evidence.id)
    if not integrity.get('is_intact', True):
        reasons.append('file_integrity_failed')
    chain = verify_hash_chain(evidence.restaurant_id)
    if not chain.get('is_valid', True):
        reasons.append('hash_chain_invalid')
    ts_result = verify_timestamp_token(evidence.id)
    if not ts_result.get('signature_valid', True):
        reasons.append('timestamp_invalid')
    backdate = detect_backdating_attempt(evidence.id)
    if backdate.get('suspicious'):
        reasons.append('backdating_suspicious')
    meta = detect_metadata_tampering(evidence.id)
    if meta.get('suspicious'):
        reasons.append('metadata_tampering')
    return (len(reasons) == 0, reasons)


class EvidenceApproveView(APIView):
    """Admin/Auditor: approve evidence (only if restaurant assigned to you or unassigned)."""
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def post(self, request, pk):
        evidence = get_object_or_404(Evidence.objects.select_related('restaurant'), pk=pk)
        if not _can_access_assigned_restaurant(request, evidence.restaurant):
            raise PermissionDenied('This work is assigned to another user.')
        notes = (request.data.get('review_notes') or '').strip()
        all_passed, failure_reasons = _run_crypto_verification(evidence)
        if not all_passed:
            evidence.status = EvidenceStatus.FLAGGED
            evidence.reviewed_by = request.user
            evidence.reviewed_timestamp = timezone.now()
            evidence.review_notes = f"{notes} [Crypto check failed: {', '.join(failure_reasons)}]".strip()
            evidence.is_cryptographically_verified = False
            evidence.save()
            data = EvidenceSerializer(evidence).data
            data['crypto_verification_failed'] = True
            data['crypto_failure_reasons'] = failure_reasons
            return Response(data, status=status.HTTP_200_OK)
        evidence.status = EvidenceStatus.APPROVED
        evidence.reviewed_by = request.user
        evidence.reviewed_timestamp = timezone.now()
        evidence.review_notes = notes
        evidence.is_cryptographically_verified = True
        evidence.save()
        return Response(EvidenceSerializer(evidence).data)


class EvidenceRejectView(APIView):
    """Admin/Auditor: reject evidence (review_notes required)."""
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def post(self, request, pk):
        evidence = get_object_or_404(Evidence.objects.select_related('restaurant'), pk=pk)
        if not _can_access_assigned_restaurant(request, evidence.restaurant):
            raise PermissionDenied('This work is assigned to another user.')
        notes = (request.data.get('review_notes') or '').strip()
        evidence.status = EvidenceStatus.REJECTED
        evidence.reviewed_by = request.user
        evidence.reviewed_timestamp = timezone.now()
        evidence.review_notes = notes
        evidence.save()
        return Response(EvidenceSerializer(evidence).data)


class EvidenceFlagView(APIView):
    """Admin/Auditor: flag evidence for secondary review."""
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def post(self, request, pk):
        evidence = get_object_or_404(Evidence.objects.select_related('restaurant'), pk=pk)
        if not _can_access_assigned_restaurant(request, evidence.restaurant):
            raise PermissionDenied('This work is assigned to another user.')
        notes = (request.data.get('review_notes') or '').strip()
        evidence.status = EvidenceStatus.FLAGGED
        evidence.reviewed_by = request.user
        evidence.reviewed_timestamp = timezone.now()
        evidence.review_notes = notes
        evidence.save()
        return Response(EvidenceSerializer(evidence).data)