from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import (
    AuditorWorkItem,
    AuditSubmissionStatus,
    AuditWorkCategoryPhoto,
    AuditWorkStatus,
    Evidence,
    EvidenceStatus,
    Role,
    RubricCategory,
)
from ..services.audit_publish import audit_visit_ready_for_submit
from ..services.audit_visit_scoring import save_audit_staging_category_scores, serialize_staging_scores
from ..permissions import IsOwnerWithRestaurant, IsAuditorOrSuperAdmin
from ..utils.storage import upload_to_supabase


def _can_view_audit_work(request, work):
    u = request.user
    if work.status == AuditWorkStatus.PENDING or work.assigned_to_id == u.id or u.role == Role.SUPER_ADMIN:
        return True
    return False


def _auditor_can_edit_visit_content(request, work):
    if work.submission_status != AuditSubmissionStatus.DRAFT:
        return False
    if work.status == AuditWorkStatus.DONE:
        return False
    u = request.user
    if u.role == Role.SUPER_ADMIN:
        return True
    return work.assigned_to_id == u.id


def _can_upload_audit_photos(request, work):
    return _auditor_can_edit_visit_content(request, work)


class OwnerRequestAuditWorkView(APIView):
    """Owner: create (or reuse) an audit work item for their restaurant."""
    permission_classes = [IsAuthenticated, IsOwnerWithRestaurant]

    def post(self, request):
        user = request.user
        restaurant = user.restaurant

        has_approved_evidence = Evidence.objects.filter(
            restaurant=restaurant, status=EvidenceStatus.APPROVED
        ).exists()
        if not has_approved_evidence:
            return Response(
                {'detail': 'At least one approved evidence item is required before requesting an auditor visit.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = AuditorWorkItem.objects.filter(
            restaurant=restaurant,
            status__in=[AuditWorkStatus.PENDING, AuditWorkStatus.IN_PROGRESS],
        ).first()
        if existing:
            return Response(
                {
                    'detail': 'An audit work item is already active for this restaurant.',
                    'work_item_id': existing.id,
                    'status': existing.status,
                },
                status=status.HTTP_200_OK,
            )

        item = AuditorWorkItem.objects.create(
            restaurant=restaurant,
            requested_by=user,
            status=AuditWorkStatus.PENDING,
        )
        return Response(
            {
                'detail': 'Audit requested. Work sent to auditors pending queue.',
                'work_item_id': item.id,
                'status': item.status,
            },
            status=status.HTTP_201_CREATED,
        )


class OwnerAuditWorkStatusView(APIView):
    """Owner: get latest audit work status for their restaurant."""
    permission_classes = [IsAuthenticated, IsOwnerWithRestaurant]

    def get(self, request):
        restaurant = request.user.restaurant
        latest = AuditorWorkItem.objects.filter(restaurant=restaurant).order_by('-requested_at').first()
        if not latest:
            return Response({'active': False, 'status': None})
        return Response(
            {
                'active': latest.status in [AuditWorkStatus.PENDING, AuditWorkStatus.IN_PROGRESS],
                'status': latest.status,
                'work_item_id': latest.id,
            }
        )


class OwnerRevokeAuditWorkView(APIView):
    """Owner: revoke latest pending audit request before anyone accepts it."""
    permission_classes = [IsAuthenticated, IsOwnerWithRestaurant]

    def post(self, request):
        restaurant = request.user.restaurant
        pending = AuditorWorkItem.objects.filter(
            restaurant=restaurant,
            status=AuditWorkStatus.PENDING,
            assigned_to__isnull=True,
        ).order_by('-requested_at').first()
        if not pending:
            return Response(
                {'detail': 'No pending audit request found to revoke.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        pending.delete()
        return Response({'detail': 'Audit request revoked.'}, status=status.HTTP_200_OK)


class AdminAuditWorkListView(APIView):
    """Auditor/Super Admin: list audit work cards."""
    permission_classes = [IsAuthenticated, IsAuditorOrSuperAdmin]

    def get(self, request):
        user = request.user
        qs = AuditorWorkItem.objects.select_related(
            'restaurant', 'requested_by', 'assigned_to'
        )

        result = []
        for w in qs:
            visible = False
            if w.status == AuditWorkStatus.PENDING:
                visible = True
            elif w.assigned_to_id == user.id:
                visible = True
            elif user.role == Role.SUPER_ADMIN:
                visible = True
            if not visible:
                continue

            result.append(
                {
                    'work_item_id': w.id,
                    'restaurant_id': w.restaurant_id,
                    'restaurant_name': w.restaurant.name,
                    'owner_name': w.requested_by.name,
                    'owner_email': w.requested_by.email,
                    'status': w.status,
                    'submission_status': w.submission_status,
                    'is_assigned_to_me': w.assigned_to_id == user.id if w.assigned_to_id else False,
                    'assigned_to_name': w.assigned_to.name if w.assigned_to_id else None,
                    'requested_at': w.requested_at,
                }
            )
        return Response(result)


class AdminAcceptAuditWorkView(APIView):
    """Auditor/Super Admin: accept one pending work item."""
    permission_classes = [IsAuthenticated, IsAuditorOrSuperAdmin]

    def post(self, request, work_item_id):
        work = get_object_or_404(AuditorWorkItem, pk=work_item_id)
        if work.status == AuditWorkStatus.DONE:
            return Response({'detail': 'This work is already completed.'}, status=status.HTTP_400_BAD_REQUEST)
        if work.assigned_to_id and work.assigned_to_id != request.user.id:
            return Response({'detail': 'This work is already assigned to someone else.'}, status=status.HTTP_403_FORBIDDEN)

        work.assigned_to = request.user
        work.status = AuditWorkStatus.IN_PROGRESS
        work.accepted_at = timezone.now()
        work.save(update_fields=['assigned_to', 'status', 'accepted_at'])
        return Response({'detail': 'Work accepted.', 'work_item_id': work.id}, status=status.HTTP_200_OK)


class AdminAuditWorkDetailView(APIView):
    """Auditor/Super Admin: get or update one work item (placeholder page support)."""
    permission_classes = [IsAuthenticated, IsAuditorOrSuperAdmin]

    def get(self, request, work_item_id):
        work = get_object_or_404(
            AuditorWorkItem.objects.select_related('restaurant', 'requested_by', 'assigned_to'),
            pk=work_item_id,
        )
        if work.status == AuditWorkStatus.PENDING or work.assigned_to_id == request.user.id or request.user.role == Role.SUPER_ADMIN:
            return Response(
                {
                    'work_item_id': work.id,
                    'restaurant_id': work.restaurant_id,
                    'restaurant_name': work.restaurant.name,
                    'owner_name': work.requested_by.name,
                    'owner_email': work.requested_by.email,
                    'status': work.status,
                    'assigned_to_id': work.assigned_to_id,
                    'assigned_to_name': work.assigned_to.name if work.assigned_to_id else None,
                    'is_assigned_to_me': work.assigned_to_id == request.user.id if work.assigned_to_id else False,
                    'submission_status': work.submission_status,
                    'category_photos_saved': work.category_photos_saved or [],
                    'category_marked_na': work.category_marked_na or [],
                    'submitted_to_admin_at': work.submitted_to_admin_at,
                    'published_at': work.published_at,
                    'flagged_at': work.flagged_at,
                    'requested_at': work.requested_at,
                    'accepted_at': work.accepted_at,
                    'completed_at': work.completed_at,
                    'staging_scores': serialize_staging_scores(work),
                }
            )
        return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)

    def patch(self, request, work_item_id):
        return Response(
            {
                'detail': 'Use POST /api/audits/admin/work/<id>/submit-to-admin/ to submit the visit for admin review.',
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class AdminAuditWorkPhotosView(APIView):
    """Auditor/Super Admin: list or upload on-site photos for a work item, per rubric category."""
    permission_classes = [IsAuthenticated, IsAuditorOrSuperAdmin]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request, work_item_id):
        work = get_object_or_404(AuditorWorkItem, pk=work_item_id)
        if not _can_view_audit_work(request, work):
            return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
        qs = AuditWorkCategoryPhoto.objects.filter(work_item=work).select_related('category', 'uploaded_by')
        return Response(
            [
                {
                    'photo_id': p.id,
                    'category_id': p.category_id,
                    'category_name': p.category.name,
                    'image_url': p.image_url,
                    'uploaded_at': p.uploaded_at,
                    'uploaded_by_name': p.uploaded_by.name if p.uploaded_by_id else None,
                }
                for p in qs
            ]
        )

    def post(self, request, work_item_id):
        work = get_object_or_404(AuditorWorkItem, pk=work_item_id)
        if not _can_view_audit_work(request, work):
            return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
        if not _can_upload_audit_photos(request, work):
            return Response(
                {'detail': 'Only the assigned auditor or Super Admin can upload photos.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        category_id = request.data.get('category_id')
        if not category_id:
            return Response({'detail': 'category_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            category_id = int(category_id)
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid category_id.'}, status=status.HTTP_400_BAD_REQUEST)
        category = RubricCategory.objects.filter(pk=category_id, is_active=True).first()
        if not category:
            return Response({'detail': 'Invalid or inactive category.'}, status=status.HTTP_400_BAD_REQUEST)

        file = request.FILES.get('file') or request.FILES.get('image')
        if not file:
            return Response({'detail': 'No file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            public_url, _ = upload_to_supabase(file, f'audit_work/{work_item_id}/{category_id}')
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except RuntimeError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        next_order = (
            AuditWorkCategoryPhoto.objects.filter(work_item=work, category_id=category_id).count()
        )
        photo = AuditWorkCategoryPhoto.objects.create(
            work_item=work,
            category=category,
            image_url=public_url,
            uploaded_by=request.user,
            display_order=next_order,
        )
        return Response(
            {
                'photo_id': photo.id,
                'category_id': photo.category_id,
                'category_name': category.name,
                'image_url': photo.image_url,
                'uploaded_at': photo.uploaded_at,
                'uploaded_by_name': request.user.name,
            },
            status=status.HTTP_201_CREATED,
        )


class AdminAuditWorkPhotoDeleteView(APIView):
    """Auditor/Super Admin: delete one uploaded photo."""
    permission_classes = [IsAuthenticated, IsAuditorOrSuperAdmin]

    def delete(self, request, work_item_id, photo_id):
        work = get_object_or_404(AuditorWorkItem, pk=work_item_id)
        if not _can_view_audit_work(request, work):
            return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
        if not _can_upload_audit_photos(request, work):
            return Response(
                {'detail': 'Only the assigned auditor or Super Admin can delete photos.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        photo = get_object_or_404(AuditWorkCategoryPhoto, pk=photo_id, work_item=work)
        photo.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AuditWorkSaveCategoryPhotosView(APIView):
    """Auditor: mark that category on-site photos are complete (enables scoring)."""
    permission_classes = [IsAuthenticated, IsAuditorOrSuperAdmin]

    def post(self, request, work_item_id):
        work = get_object_or_404(AuditorWorkItem, pk=work_item_id)
        if not _can_view_audit_work(request, work):
            return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
        if not _auditor_can_edit_visit_content(request, work):
            return Response(
                {'detail': 'This visit cannot be edited (submit or draft locked).'},
                status=status.HTTP_403_FORBIDDEN,
            )
        category_id = request.data.get('category_id')
        if category_id is None:
            return Response({'detail': 'category_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            category_id = int(category_id)
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid category_id.'}, status=status.HTTP_400_BAD_REQUEST)
        if not AuditWorkCategoryPhoto.objects.filter(work_item=work, category_id=category_id).exists():
            return Response(
                {'detail': 'Add at least one photo for this category before saving.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        saved = list(work.category_photos_saved or [])
        if category_id not in saved:
            saved.append(category_id)
        work.category_photos_saved = saved
        work.save(update_fields=['category_photos_saved'])
        return Response({'detail': 'Category evidence saved.', 'category_photos_saved': saved})


class AuditWorkStagingScoresView(APIView):
    """Auditor: save staged rubric scores for one category (not visible to owner until admin publishes)."""
    permission_classes = [IsAuthenticated, IsAuditorOrSuperAdmin]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request, work_item_id):
        work = get_object_or_404(AuditorWorkItem, pk=work_item_id)
        if not _can_view_audit_work(request, work):
            return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
        if not _auditor_can_edit_visit_content(request, work):
            return Response(
                {'detail': 'This visit cannot be edited.'},
                status=status.HTTP_403_FORBIDDEN,
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
        if category_id not in (work.category_photos_saved or []) and is_applicable:
            return Response(
                {'detail': 'Save category photos for this category before scoring.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not isinstance(subcategories, list) and is_applicable:
            return Response({'detail': 'subcategories must be a list.'}, status=status.HTTP_400_BAD_REQUEST)
        if not is_applicable:
            err = save_audit_staging_category_scores(request, work, category_id, False, [])
        else:
            err = save_audit_staging_category_scores(
                request, work, category_id, True, subcategories or []
            )
        if err is not None:
            return err
        return Response(
            {
                'detail': 'Staging scores saved.',
                'staging_scores': serialize_staging_scores(work),
            }
        )


class AuditWorkSubmitToAdminView(APIView):
    """Auditor: submit completed visit to admin for approval (owner scores unchanged until admin publishes)."""
    permission_classes = [IsAuthenticated, IsAuditorOrSuperAdmin]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request, work_item_id):
        work = get_object_or_404(AuditorWorkItem, pk=work_item_id)
        if not _can_view_audit_work(request, work):
            return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
        if work.assigned_to_id != request.user.id and request.user.role != Role.SUPER_ADMIN:
            return Response({'detail': 'Only the assigned auditor can submit.'}, status=status.HTTP_403_FORBIDDEN)
        if work.submission_status != AuditSubmissionStatus.DRAFT:
            return Response({'detail': 'This visit was already submitted.'}, status=status.HTTP_400_BAD_REQUEST)
        ok, msg = audit_visit_ready_for_submit(work)
        if not ok:
            return Response({'detail': msg}, status=status.HTTP_400_BAD_REQUEST)
        work.submission_status = AuditSubmissionStatus.SUBMITTED_TO_ADMIN
        work.submitted_to_admin_at = timezone.now()
        work.save(update_fields=['submission_status', 'submitted_to_admin_at'])
        return Response(
            {
                'detail': 'Submitted to admin for review.',
                'work_item_id': work.id,
                'submission_status': work.submission_status,
            }
        )
