from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import AuditorWorkItem, AuditWorkStatus, Evidence, EvidenceStatus, Role
from ..permissions import IsOwnerWithRestaurant, IsAdminOrAuditor


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
    """Admin/Auditor: list audit work cards."""
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

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
                    'is_assigned_to_me': w.assigned_to_id == user.id if w.assigned_to_id else False,
                    'assigned_to_name': w.assigned_to.name if w.assigned_to_id else None,
                    'requested_at': w.requested_at,
                }
            )
        return Response(result)


class AdminAcceptAuditWorkView(APIView):
    """Admin/Auditor: accept one pending work item."""
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

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
    """Admin/Auditor: get or update one work item (placeholder page support)."""
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

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
                    'assigned_to_name': work.assigned_to.name if work.assigned_to_id else None,
                    'requested_at': work.requested_at,
                    'accepted_at': work.accepted_at,
                    'completed_at': work.completed_at,
                }
            )
        return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)

    def patch(self, request, work_item_id):
        work = get_object_or_404(AuditorWorkItem, pk=work_item_id)
        action = request.data.get('action')
        if action != 'mark_done':
            return Response({'detail': 'Unsupported action.'}, status=status.HTTP_400_BAD_REQUEST)
        if work.assigned_to_id != request.user.id and request.user.role != Role.SUPER_ADMIN:
            return Response({'detail': 'Only assignee can mark done.'}, status=status.HTTP_403_FORBIDDEN)

        work.status = AuditWorkStatus.DONE
        work.completed_at = timezone.now()
        work.save(update_fields=['status', 'completed_at'])
        return Response({'detail': 'Work marked as done.'}, status=status.HTTP_200_OK)
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


