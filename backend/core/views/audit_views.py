import os
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated

from ..models import (
    Audit,
    AuditEvidence,
    AuditEvidenceTimestamp,
    AuditScore,
    AuditStatus,
    EvidenceFileType,
    Restaurant,
    RubricCategory,
    RubricSubCategory,
    Score,
)
from ..serializers import (
    AuditSerializer,
    AuditListSerializer,
    AuditEvidenceSerializer,
    AuditEvidenceUploadSerializer,
    AuditScoreSubmitSerializer,
)
from ..permissions import IsOwnerWithRestaurant, IsAdmin, IsAdminOrAuditor, IsSuperAdmin
from ..services.scoring import recompute_restaurant_scores
from ..utils.storage import upload_to_supabase
from ..crypto.audit_chain import (
    add_audit_evidence_to_chain,
    update_audit_chain_after_append,
)
from ..crypto.audit_timestamps import create_audit_timestamp_token
from ..crypto.audit_merkle import build_audit_merkle_tree
from ..crypto.audit_tamper import run_initial_forensics_audit

# Same limits as owner evidence upload
AUDIT_EVIDENCE_ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'mp4'}
AUDIT_EVIDENCE_MAX_FILE_SIZE = 50 * 1024 * 1024
AUDIT_EVIDENCE_MAX_FILES = 5
AUDIT_EXT_TO_FILE_TYPE = {
    'jpg': EvidenceFileType.IMAGE,
    'jpeg': EvidenceFileType.IMAGE,
    'png': EvidenceFileType.IMAGE,
    'mp4': EvidenceFileType.VIDEO,
}


class OwnerAuditRequestView(APIView):
    """Owner: request an on-site audit for their restaurant."""
    permission_classes = [IsAuthenticated, IsOwnerWithRestaurant]

    def post(self, request):
        restaurant = request.user.restaurant
        # Prevent multiple open audits for the same restaurant
        has_open = Audit.objects.filter(
            restaurant=restaurant,
            status__in=[
                AuditStatus.REQUESTED,
                AuditStatus.ASSIGNED,
                AuditStatus.IN_PROGRESS,
                AuditStatus.SUBMITTED_BY_AUDITOR,
            ],
        ).exists()
        if has_open:
            return Response(
                {'detail': 'There is already an active audit for this restaurant.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        audit = Audit.objects.create(
            restaurant=restaurant,
            requested_by=request.user,
            status=AuditStatus.REQUESTED,
        )
        return Response(AuditSerializer(audit).data, status=status.HTTP_201_CREATED)


class AuditorMyAuditsListView(generics.ListAPIView):
    """Auditor: list audits assigned to me."""
    serializer_class = AuditListSerializer
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def get_queryset(self):
        user = self.request.user
        # Only auditors (or super admin) should see this list
        if user.role not in ('AUDITOR', 'SUPER_ADMIN'):
            return Audit.objects.none()
        return Audit.objects.filter(
            assigned_to=user,
            status__in=[
                AuditStatus.ASSIGNED,
                AuditStatus.IN_PROGRESS,
                AuditStatus.SUBMITTED_BY_AUDITOR,
            ],
        ).select_related('restaurant', 'assigned_to')


class AuditorAuditDetailView(generics.RetrieveAPIView):
    """Auditor: get details of a specific audit assigned to me."""
    serializer_class = AuditSerializer
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]
    queryset = Audit.objects.select_related('restaurant', 'requested_by', 'assigned_to')

    def get_object(self):
        audit = super().get_object()
        user = self.request.user
        if user.role != 'SUPER_ADMIN' and audit.assigned_to_id != user.id:
            # Hide details if not assigned to this auditor
            raise get_object_or_404(Audit, pk=0)  # 404
        return audit


class AuditorStartAuditView(APIView):
    """Auditor: mark an assigned audit as in progress."""
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def post(self, request, pk):
        audit = get_object_or_404(Audit.objects.select_related('assigned_to'), pk=pk)
        user = request.user
        if user.role != 'SUPER_ADMIN' and audit.assigned_to_id != user.id:
            return Response({'detail': 'This audit is not assigned to you.'}, status=status.HTTP_403_FORBIDDEN)
        if audit.status not in (AuditStatus.ASSIGNED, AuditStatus.IN_PROGRESS):
            return Response({'detail': 'Audit cannot be started in its current state.'}, status=status.HTTP_400_BAD_REQUEST)
        if audit.status != AuditStatus.IN_PROGRESS:
            audit.status = AuditStatus.IN_PROGRESS
            audit.started_at = timezone.now()
            audit.save(update_fields=['status', 'started_at'])
        return Response(AuditSerializer(audit).data, status=status.HTTP_200_OK)


class AuditorEvidenceUploadView(APIView):
    """Auditor: upload evidence for an audit (multipart: category_id, description, files). Uses separate audit hash chain."""
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def post(self, request, pk):
        audit = get_object_or_404(Audit.objects.select_related('restaurant', 'assigned_to'), pk=pk)
        user = request.user
        if user.role != 'SUPER_ADMIN' and audit.assigned_to_id != user.id:
            return Response({'detail': 'This audit is not assigned to you.'}, status=status.HTTP_403_FORBIDDEN)
        if audit.status not in (AuditStatus.ASSIGNED, AuditStatus.IN_PROGRESS):
            return Response({'detail': 'Cannot upload evidence for this audit in its current state.'}, status=status.HTTP_400_BAD_REQUEST)

        ser = AuditEvidenceUploadSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        category = get_object_or_404(RubricCategory, pk=data['category_id'], is_active=True)
        description = (data.get('description') or '').strip()

        files = []
        for key in list(request.FILES.keys()):
            f = request.FILES.get(key)
            if f:
                files.append(f)
        if not files:
            return Response({'detail': 'At least one file is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(files) > AUDIT_EVIDENCE_MAX_FILES:
            return Response(
                {'detail': f'Maximum {AUDIT_EVIDENCE_MAX_FILES} files per upload.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prefix = f'audit_evidence/{audit.id}'
        created = []
        for f in files:
            ext = os.path.splitext(f.name)[1].lstrip('.').lower()
            if ext not in AUDIT_EVIDENCE_ALLOWED_EXTENSIONS:
                return Response(
                    {'detail': f'Allowed types: JPEG, PNG, MP4. Got: {ext}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if f.size > AUDIT_EVIDENCE_MAX_FILE_SIZE:
                return Response(
                    {'detail': 'File exceeds 50MB limit.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            content = f.read()
            metadata = {
                'timestamp': timezone.now().isoformat(),
                'auditor_id': user.id,
                'audit_id': audit.id,
                'category': category.name,
                'filename': os.path.basename(f.name),
            }
            try:
                hash_data = add_audit_evidence_to_chain(audit.id, content, metadata)
            except Exception:
                return Response(
                    {'detail': 'Audit hash chain computation failed.'},
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
            except RuntimeError:
                return Response({'detail': 'Upload to storage failed.'}, status=status.HTTP_502_BAD_GATEWAY)

            file_type = AUDIT_EXT_TO_FILE_TYPE.get(ext, EvidenceFileType.IMAGE)
            evidence = AuditEvidence.objects.create(
                audit=audit,
                restaurant=audit.restaurant,
                category=category,
                file_url=public_url,
                file_type=file_type,
                original_filename=os.path.basename(f.name),
                file_size_bytes=len(content),
                mime_type=mime_type,
                description=description,
                hash_value=hash_data['hash_value'],
                previous_hash=hash_data['previous_hash'],
                chain_index=hash_data['chain_index'],
                nonce=hash_data['nonce'],
                file_content_hash=hash_data['file_content_hash'],
                is_chain_valid=True,
            )
            update_audit_chain_after_append(audit.id, hash_data['hash_value'])
            token = create_audit_timestamp_token(evidence.id, hash_data['hash_value'])
            AuditEvidenceTimestamp.objects.create(
                audit_evidence=evidence,
                timestamp_token=token,
                server_time=timezone.now(),
                hash_at_timestamp=hash_data['hash_value'],
                is_verified=True,
            )
            try:
                build_audit_merkle_tree(audit.id)
            except Exception:
                pass
            try:
                run_initial_forensics_audit(evidence.id)
            except Exception:
                pass
            created.append(evidence)

        return Response(AuditEvidenceSerializer(created, many=True).data, status=status.HTTP_201_CREATED)


class AuditorEvidenceListView(generics.ListAPIView):
    """Auditor: list evidence for an audit."""
    serializer_class = AuditEvidenceSerializer
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def get_queryset(self):
        audit_id = self.kwargs.get('pk')
        audit = get_object_or_404(Audit.objects.select_related('assigned_to'), pk=audit_id)
        user = self.request.user
        if user.role != 'SUPER_ADMIN' and audit.assigned_to_id != user.id:
            return AuditEvidence.objects.none()
        return AuditEvidence.objects.filter(audit=audit).select_related('category')


class AuditorScoreSubmitView(APIView):
    """Auditor: submit scores for a category within an audit (overwrites existing for that category)."""
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def post(self, request):
        ser = AuditScoreSubmitSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        audit_id = data['audit_id']
        category_id = data['category_id']

        audit = get_object_or_404(Audit.objects.select_related('restaurant', 'assigned_to'), pk=audit_id)
        user = request.user
        if user.role != 'SUPER_ADMIN' and audit.assigned_to_id != user.id:
            return Response({'detail': 'This audit is not assigned to you.'}, status=status.HTTP_403_FORBIDDEN)
        if audit.status not in (AuditStatus.ASSIGNED, AuditStatus.IN_PROGRESS):
            return Response({'detail': 'Cannot submit scores for this audit in its current state.'}, status=status.HTTP_400_BAD_REQUEST)

        restaurant = audit.restaurant
        category = get_object_or_404(RubricCategory, pk=category_id, is_active=True)

        subcategories_data = data['subcategories']
        subcategory_ids = {s['subcategory_id'] for s in subcategories_data}
        subcats = {
            s.id: s
            for s in RubricSubCategory.objects.filter(
                category=category,
                id__in=subcategory_ids,
            )
        }
        for item in subcategories_data:
            sid = item['subcategory_id']
            if sid not in subcats:
                return Response(
                    {'detail': f'Invalid subcategory_id: {sid}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            sub = subcats[sid]
            if not (0 <= item['score'] <= sub.max_score):
                return Response(
                    {'detail': f'Score for {sub.name} must be 0-{sub.max_score}.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Overwrite existing scores for this audit+category
        AuditScore.objects.filter(audit=audit, category=category).delete()
        for item in subcategories_data:
            sub = subcats[item['subcategory_id']]
            AuditScore.objects.create(
                audit=audit,
                restaurant=restaurant,
                category=category,
                subcategory=sub,
                score=item['score'],
                notes=(item.get('notes') or '').strip(),
                scored_by=user,
            )

        return Response({'detail': 'Audit scores saved.', 'audit_id': audit_id}, status=status.HTTP_200_OK)


class AuditorSubmitAuditView(APIView):
    """Auditor: mark audit as submitted to admin for review."""
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def post(self, request, pk):
        audit = get_object_or_404(Audit.objects.select_related('assigned_to'), pk=pk)
        user = request.user
        if user.role != 'SUPER_ADMIN' and audit.assigned_to_id != user.id:
            return Response({'detail': 'This audit is not assigned to you.'}, status=status.HTTP_403_FORBIDDEN)
        if audit.status not in (AuditStatus.ASSIGNED, AuditStatus.IN_PROGRESS):
            return Response({'detail': 'Audit cannot be submitted in its current state.'}, status=status.HTTP_400_BAD_REQUEST)
        # Require at least one score as a minimal guard
        has_scores = AuditScore.objects.filter(audit=audit).exists()
        if not has_scores:
            return Response({'detail': 'Add at least one score before submitting.'}, status=status.HTTP_400_BAD_REQUEST)
        audit.status = AuditStatus.SUBMITTED_BY_AUDITOR
        audit.submitted_at = timezone.now()
        audit.save(update_fields=['status', 'submitted_at'])
        return Response(AuditSerializer(audit).data, status=status.HTTP_200_OK)


class AdminPendingAuditsView(generics.ListAPIView):
    """Admin: list audits submitted by auditors that need review."""
    serializer_class = AuditListSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_queryset(self):
        return Audit.objects.filter(
            status=AuditStatus.SUBMITTED_BY_AUDITOR,
        ).select_related('restaurant', 'assigned_to')


class AdminAuditDetailView(generics.RetrieveAPIView):
    """Admin: get full details for an audit (for review)."""
    serializer_class = AuditSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    queryset = Audit.objects.select_related('restaurant', 'requested_by', 'assigned_to')


class AdminAuditEvidenceListView(generics.ListAPIView):
    """Admin: list all evidence for an audit."""
    serializer_class = AuditEvidenceSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_queryset(self):
        audit_id = self.kwargs.get('pk')
        audit = get_object_or_404(Audit, pk=audit_id)
        return AuditEvidence.objects.filter(audit=audit).select_related('category')


class AdminAuditApproveView(APIView):
    """
    Admin: approve an audit and apply its scores to the main Score table,
    recomputing the restaurant credibility score.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        audit = get_object_or_404(
            Audit.objects.select_related('restaurant'),
            pk=pk,
        )
        if audit.status != AuditStatus.SUBMITTED_BY_AUDITOR:
            return Response(
                {'detail': 'Only audits submitted by an auditor can be approved.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        restaurant = audit.restaurant
        # All scores for this audit
        audit_scores = list(
            AuditScore.objects.filter(audit=audit).select_related('subcategory', 'category')
        )
        if not audit_scores:
            return Response(
                {'detail': 'This audit has no scores to apply.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # Determine which categories are covered by this audit
            category_ids = {s.category_id for s in audit_scores}
            # Remove existing scores for these categories for this restaurant
            Score.objects.filter(restaurant=restaurant, category_id__in=category_ids).delete()

            # Insert new scores from audit
            for s in audit_scores:
                Score.objects.create(
                    restaurant=restaurant,
                    category=s.category,
                    subcategory=s.subcategory,
                    score=s.score,
                    notes=s.notes,
                    scored_by=request.user,  # admin is final reviewer
                    is_category_applicable=True,
                )

            # Recompute restaurant cached score/breakdown
            recompute_restaurant_scores(restaurant.id)

            audit.status = AuditStatus.REVIEWED_BY_ADMIN
            audit.reviewed_at = timezone.now()
            audit.review_notes = (request.data.get('review_notes') or '').strip()
            audit.save(update_fields=['status', 'reviewed_at', 'review_notes'])

        return Response(AuditSerializer(audit).data, status=status.HTTP_200_OK)


class AdminAuditRejectView(APIView):
    """Admin: reject an audit (does not apply scores)."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        audit = get_object_or_404(Audit, pk=pk)
        if audit.status != AuditStatus.SUBMITTED_BY_AUDITOR:
            return Response(
                {'detail': 'Only audits submitted by an auditor can be rejected.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        audit.status = AuditStatus.CANCELLED
        audit.reviewed_at = timezone.now()
        audit.review_notes = (request.data.get('review_notes') or '').strip()
        audit.save(update_fields=['status', 'reviewed_at', 'review_notes'])
        return Response(AuditSerializer(audit).data, status=status.HTTP_200_OK)


class SuperAdminAuditListView(generics.ListAPIView):
    """Super Admin: list all audits with optional filters (status, assigned_to, restaurant)."""
    serializer_class = AuditListSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get_queryset(self):
        qs = Audit.objects.all().select_related('restaurant', 'assigned_to')
        status_filter = self.request.query_params.get('status', '').strip()
        assigned_to = self.request.query_params.get('assigned_to', '').strip()
        restaurant_id = self.request.query_params.get('restaurant_id', '').strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        if assigned_to:
            try:
                qs = qs.filter(assigned_to_id=int(assigned_to))
            except ValueError:
                pass
        if restaurant_id:
            try:
                qs = qs.filter(restaurant_id=int(restaurant_id))
            except ValueError:
                pass
        return qs


class SuperAdminAuditAssignView(APIView):
    """Super Admin: assign or reassign an audit to an auditor."""
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def post(self, request, pk):
        from django.contrib.auth import get_user_model

        User = get_user_model()

        audit = get_object_or_404(Audit.objects.select_related('restaurant'), pk=pk)
        auditor_id = request.data.get('auditor_id')
        if not auditor_id:
            return Response({'detail': 'auditor_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            auditor_id = int(auditor_id)
        except (TypeError, ValueError):
            return Response({'detail': 'auditor_id must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

        auditor = get_object_or_404(User, pk=auditor_id)
        if auditor.role != 'AUDITOR':
            return Response({'detail': 'Can only assign audits to users with AUDITOR role.'}, status=status.HTTP_400_BAD_REQUEST)

        if audit.status not in (
            AuditStatus.REQUESTED,
            AuditStatus.ASSIGNED,
            AuditStatus.IN_PROGRESS,
        ):
            return Response(
                {'detail': 'Only requested or in-progress audits can be assigned.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        audit.assigned_to = auditor
        audit.assigned_at = timezone.now()
        if audit.status == AuditStatus.REQUESTED:
            audit.status = AuditStatus.ASSIGNED
        audit.save(update_fields=['assigned_to', 'assigned_at', 'status'])
        return Response(AuditSerializer(audit).data, status=status.HTTP_200_OK)

