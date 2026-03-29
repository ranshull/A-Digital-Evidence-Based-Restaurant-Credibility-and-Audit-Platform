"""Admin-only: review auditor field visits before publishing scores to owners."""
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import (
    AuditSubmissionStatus,
    AuditWorkCategoryPhoto,
    AuditorWorkItem,
    Role,
)
from ..permissions import IsAdminOrSuperAdmin
from ..services.audit_publish import publish_audit_visit_to_restaurant_scores
from ..services.audit_visit_scoring import save_audit_staging_category_scores, serialize_staging_scores


class AdminAuditorEvidenceListView(APIView):
    """List audit work items waiting for admin review (or flagged)."""
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request):
        qs = (
            AuditorWorkItem.objects.filter(
                submission_status__in=[
                    AuditSubmissionStatus.SUBMITTED_TO_ADMIN,
                    AuditSubmissionStatus.FLAGGED,
                ]
            )
            .select_related('restaurant', 'requested_by', 'assigned_to')
            .order_by('-submitted_to_admin_at', '-requested_at')
        )
        result = []
        for w in qs:
            result.append(
                {
                    'work_item_id': w.id,
                    'restaurant_id': w.restaurant_id,
                    'restaurant_name': w.restaurant.name,
                    'owner_name': w.requested_by.name,
                    'auditor_name': w.assigned_to.name if w.assigned_to_id else None,
                    'submission_status': w.submission_status,
                    'submitted_to_admin_at': w.submitted_to_admin_at,
                    'flagged_at': w.flagged_at,
                }
            )
        return Response(result)


class AdminAuditorEvidenceDetailView(APIView):
    """Full detail for one work item: photos, staged scores, metadata."""
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request, work_item_id):
        work = get_object_or_404(
            AuditorWorkItem.objects.select_related(
                'restaurant', 'requested_by', 'assigned_to'
            ),
            pk=work_item_id,
        )
        if work.submission_status not in (
            AuditSubmissionStatus.SUBMITTED_TO_ADMIN,
            AuditSubmissionStatus.FLAGGED,
            AuditSubmissionStatus.PUBLISHED,
        ):
            return Response(
                {'detail': 'This visit is not available for admin review yet.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        photos = [
            {
                'photo_id': p.id,
                'category_id': p.category_id,
                'category_name': p.category.name,
                'image_url': p.image_url,
                'uploaded_at': p.uploaded_at,
            }
            for p in AuditWorkCategoryPhoto.objects.filter(work_item=work).select_related('category')
        ]
        return Response(
            {
                'work_item_id': work.id,
                'restaurant_id': work.restaurant_id,
                'restaurant_name': work.restaurant.name,
                'owner_name': work.requested_by.name,
                'owner_email': work.requested_by.email,
                'assigned_to_id': work.assigned_to_id,
                'assigned_to_name': work.assigned_to.name if work.assigned_to_id else None,
                'submission_status': work.submission_status,
                'category_photos_saved': work.category_photos_saved or [],
                'category_marked_na': work.category_marked_na or [],
                'submitted_to_admin_at': work.submitted_to_admin_at,
                'flagged_at': work.flagged_at,
                'photos': photos,
                'staging_scores': serialize_staging_scores(work),
                'staging_edit_log': work.staging_edit_log or [],
            }
        )


class AdminAuditorEvidenceApproveView(APIView):
    """Publish staged scores to Score and recompute; mark work item published."""
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def post(self, request, work_item_id):
        work = get_object_or_404(AuditorWorkItem, pk=work_item_id)
        if work.submission_status not in (
            AuditSubmissionStatus.SUBMITTED_TO_ADMIN,
            AuditSubmissionStatus.FLAGGED,
        ):
            return Response(
                {'detail': 'This visit is not awaiting admin approval.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            publish_audit_visit_to_restaurant_scores(work, published_by=request.user)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(
            {
                'detail': 'Audit scores published. Owner can see updated credibility.',
                'work_item_id': work.id,
                'restaurant_id': work.restaurant_id,
            }
        )


class AdminAuditorEvidenceStagingScoresView(APIView):
    """Admin: edit staging scores only (before or while SUBMITTED_TO_ADMIN)."""
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def patch(self, request, work_item_id):
        work = get_object_or_404(AuditorWorkItem, pk=work_item_id)
        if work.submission_status not in (
            AuditSubmissionStatus.SUBMITTED_TO_ADMIN,
            AuditSubmissionStatus.FLAGGED,
        ):
            return Response(
                {'detail': 'Scores can only be edited while awaiting review or flagged.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        category_id = request.data.get('category_id')
        is_applicable = request.data.get('is_category_applicable', True)
        subcategories = request.data.get('subcategories')
        if category_id is None:
            return Response({'detail': 'category_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            category_id = int(category_id)
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid category_id.'}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(subcategories, list) and is_applicable:
            return Response({'detail': 'subcategories must be a list.'}, status=status.HTTP_400_BAD_REQUEST)

        edit_reason = (request.data.get('edit_reason') or '').strip()
        if len(edit_reason) < 3:
            return Response(
                {
                    'detail': 'Provide a reason for this edit (at least 3 characters) in edit_reason.',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not is_applicable:
            err = save_audit_staging_category_scores(
                request, work, category_id, False, []
            )
        else:
            err = save_audit_staging_category_scores(
                request, work, category_id, True, subcategories or []
            )
        if err is not None:
            return err

        with transaction.atomic():
            work.refresh_from_db()
            log = list(work.staging_edit_log or [])
            log.append(
                {
                    'at': timezone.now().isoformat(),
                    'admin_name': request.user.name,
                    'admin_email': request.user.email,
                    'reason': edit_reason,
                    'category_id': category_id,
                }
            )
            work.staging_edit_log = log
            work.save(update_fields=['staging_edit_log'])

        return Response(
            {
                'detail': 'Staging scores updated.',
                'staging_scores': serialize_staging_scores(work),
                'staging_edit_log': work.staging_edit_log,
            }
        )


class AdminAuditorEvidenceFlagView(APIView):
    """Flag a submission for follow-up (no publish)."""
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def post(self, request, work_item_id):
        work = get_object_or_404(AuditorWorkItem, pk=work_item_id)
        if work.submission_status != AuditSubmissionStatus.SUBMITTED_TO_ADMIN:
            return Response(
                {'detail': 'Only submitted visits can be flagged.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        work.submission_status = AuditSubmissionStatus.FLAGGED
        work.flagged_at = timezone.now()
        work.save(update_fields=['submission_status', 'flagged_at'])
        return Response({'detail': 'Flagged for follow-up.', 'work_item_id': work.id})
