import os
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied

from ..models import Evidence, EvidenceFileType, EvidenceStatus, RubricCategory, Restaurant
from ..serializers import EvidenceSerializer, EvidenceUploadSerializer
from ..permissions import IsOwnerWithRestaurant, IsAdminOrAuditor
from ..utils.storage import upload_to_supabase


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

            try:
                public_url, mime_type = upload_to_supabase(f, prefix)
            except ValueError as e:
                return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            except RuntimeError as e:
                return Response({'detail': 'Upload to storage failed.'}, status=status.HTTP_502_BAD_GATEWAY)

            file_type = EXT_TO_FILE_TYPE.get(ext, EvidenceFileType.IMAGE)
            evidence = Evidence.objects.create(
                restaurant=restaurant,
                uploaded_by=request.user,
                category=category,
                file_url=public_url,
                file_type=file_type,
                original_filename=os.path.basename(f.name),
                file_size_bytes=f.size,
                mime_type=mime_type,
                description=description,
                status=EvidenceStatus.PENDING,
            )
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


class EvidenceApproveView(APIView):
    """Admin/Auditor: approve evidence (only if restaurant assigned to you or unassigned)."""
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def post(self, request, pk):
        evidence = get_object_or_404(Evidence.objects.select_related('restaurant'), pk=pk)
        if not _can_access_assigned_restaurant(request, evidence.restaurant):
            raise PermissionDenied('This work is assigned to another user.')
        notes = (request.data.get('review_notes') or '').strip()
        evidence.status = EvidenceStatus.APPROVED
        evidence.reviewed_by = request.user
        evidence.reviewed_timestamp = timezone.now()
        evidence.review_notes = notes
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