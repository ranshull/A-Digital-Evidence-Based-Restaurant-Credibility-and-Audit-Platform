from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q, Count
from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from ..models import (
    Role,
    Restaurant,
    Evidence,
    Score,
    EvidenceStatus,
)
from ..serializers import (
    SuperAdminUserListSerializer,
    SuperAdminUserCreateSerializer,
    SuperAdminUserUpdateSerializer,
)
from ..permissions import IsSuperAdmin

User = get_user_model()


class SuperAdminUserListView(generics.ListAPIView):
    """List users with optional search by name or email."""
    serializer_class = SuperAdminUserListSerializer
    permission_classes = [IsSuperAdmin]

    def get_queryset(self):
        qs = User.objects.all().order_by('-created_at')
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search) | Q(email__icontains=search)
            )
        return qs


class SuperAdminUserDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve or update user (role, is_active, etc.)."""
    queryset = User.objects.all()
    serializer_class = SuperAdminUserUpdateSerializer
    permission_classes = [IsSuperAdmin]


class SuperAdminUserCreateView(generics.CreateAPIView):
    """Create user (e.g. new Admin or Auditor)."""
    queryset = User.objects.all()
    serializer_class = SuperAdminUserCreateSerializer
    permission_classes = [IsSuperAdmin]


class SuperAdminLogsView(APIView):
    """Super Admin: list work done and pending per restaurant (from Evidence + Score)."""
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        restaurants = Restaurant.objects.all().order_by('name')
        result = []
        for r in restaurants:
            # Work done: evidence reviews (who, when, action)
            evidence_reviews = []
            for e in Evidence.objects.filter(restaurant=r).exclude(
                status=EvidenceStatus.PENDING
            ).select_related('category', 'reviewed_by'):
                evidence_reviews.append({
                    'evidence_id': e.id,
                    'category_name': e.category.name if e.category_id else None,
                    'action': e.status,
                    'reviewed_by_name': e.reviewed_by.name if e.reviewed_by_id else None,
                    'reviewed_by_email': e.reviewed_by.email if e.reviewed_by_id else None,
                    'reviewed_timestamp': e.reviewed_timestamp,
                })
            # Work done: score submissions (who, when) – one entry per category that has scores
            score_submissions = []
            seen_categories = set()
            for s in Score.objects.filter(restaurant=r).select_related('category', 'scored_by').order_by('scored_timestamp'):
                if s.category_id not in seen_categories:
                    seen_categories.add(s.category_id)
                    score_submissions.append({
                        'category_name': s.category.name if s.category_id else None,
                        'scored_by_name': s.scored_by.name if s.scored_by_id else None,
                        'scored_by_email': s.scored_by.email if s.scored_by_id else None,
                        'scored_timestamp': s.scored_timestamp,
                    })
            # Pending: count PENDING evidence; whether restaurant has any scores
            pending_evidence_count = Evidence.objects.filter(restaurant=r, status=EvidenceStatus.PENDING).count()
            has_scores = Score.objects.filter(restaurant=r).exists()
            result.append({
                'restaurant_id': r.id,
                'restaurant_name': r.name,
                'work_done': {
                    'evidence_reviews': evidence_reviews,
                    'score_submissions': score_submissions,
                },
                'pending': {
                    'pending_evidence_count': pending_evidence_count,
                    'has_scores': has_scores,
                },
            })
        return Response(result)


class SuperAdminRollbackView(APIView):
    """Super Admin: rollback a restaurant to initial state (evidence PENDING, scores removed)."""
    permission_classes = [IsSuperAdmin]

    def post(self, request, restaurant_id):
        restaurant = get_object_or_404(Restaurant, pk=restaurant_id)
        with transaction.atomic():
            # Reset all evidence to PENDING and clear review fields
            Evidence.objects.filter(restaurant=restaurant).update(
                status=EvidenceStatus.PENDING,
                reviewed_by_id=None,
                review_notes='',
                reviewed_timestamp=None,
            )
            # Delete all scores for this restaurant
            Score.objects.filter(restaurant=restaurant).delete()
            # Clear cached score fields and assignment on restaurant
            restaurant.credibility_score = None
            restaurant.last_audit_at = None
            restaurant.score_breakdown = None
            restaurant.review_assigned_to = None
            restaurant.review_assigned_at = None
            restaurant.save(update_fields=['credibility_score', 'last_audit_at', 'score_breakdown', 'review_assigned_to', 'review_assigned_at'])
        return Response(
            {'detail': 'Restaurant rolled back to initial state.', 'restaurant_id': restaurant_id},
            status=status.HTTP_200_OK,
        )


class SuperAdminStaffWorkloadView(APIView):
    """Super Admin: list staff (Admin/Auditor) with accepted work count. Filters: year, month, day (date), role, search. Sort: accepted_work."""
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        year = request.query_params.get('year', '').strip()
        month = request.query_params.get('month', '').strip()
        day = request.query_params.get('day', '').strip()
        role_filter = request.query_params.get('role', '').strip().upper()
        search = request.query_params.get('search', '').strip()
        sort = request.query_params.get('sort', 'accepted_work_desc').strip()

        qs = User.objects.filter(role__in=(Role.ADMIN, Role.AUDITOR))
        if role_filter in (Role.ADMIN, Role.AUDITOR):
            qs = qs.filter(role=role_filter)
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(email__icontains=search))

        # Date filter for assignment: Count only restaurants assigned in this period (Restaurant.review_assigned_at)
        date_filter = Q()
        if year:
            try:
                y = int(year)
                date_filter &= Q(assigned_review_restaurants__review_assigned_at__year=y)
                if month:
                    m = int(month)
                    date_filter &= Q(assigned_review_restaurants__review_assigned_at__month=m)
                    if day:
                        d = int(day)
                        date_filter &= Q(assigned_review_restaurants__review_assigned_at__day=d)
            except ValueError:
                pass

        if date_filter:
            qs = qs.annotate(
                accepted_count=Count('assigned_review_restaurants', filter=date_filter, distinct=True),
            )
        else:
            qs = qs.annotate(
                accepted_count=Count('assigned_review_restaurants', distinct=True),
            )
        if sort == 'accepted_work_asc':
            qs = qs.order_by('accepted_count', 'name')
        elif sort == 'name_asc':
            qs = qs.order_by('name')
        elif sort == 'name_desc':
            qs = qs.order_by('-name')
        else:
            qs = qs.order_by('-accepted_count', 'name')

        result = [
            {
                'id': u.id,
                'name': u.name,
                'email': u.email,
                'role': u.role,
                'accepted_work_count': getattr(u, 'accepted_count', 0) or 0,
            }
            for u in qs
        ]
        return Response(result)


class SuperAdminUnassignedWorkView(APIView):
    """Super Admin: list restaurants with pending evidence that are not assigned to anyone."""
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = Restaurant.objects.filter(
            evidence__status=EvidenceStatus.PENDING,
            review_assigned_to__isnull=True,
        ).distinct()
        result = []
        for r in qs:
            pending_count = Evidence.objects.filter(restaurant=r, status=EvidenceStatus.PENDING).count()
            result.append({
                'restaurant_id': r.id,
                'restaurant_name': r.name,
                'pending_evidence_count': pending_count,
            })
        return Response(result)


class SuperAdminAssignWorkView(APIView):
    """Super Admin: assign a restaurant (unassigned work) to a user."""
    permission_classes = [IsSuperAdmin]

    def post(self, request):
        restaurant_id = request.data.get('restaurant_id')
        user_id = request.data.get('user_id')
        if not restaurant_id or not user_id:
            return Response(
                {'detail': 'restaurant_id and user_id are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        restaurant = get_object_or_404(Restaurant, pk=restaurant_id)
        user = get_object_or_404(User, pk=user_id)
        if user.role not in (Role.ADMIN, Role.AUDITOR):
            return Response(
                {'detail': 'Can only assign work to Admin or Auditor.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not Evidence.objects.filter(restaurant=restaurant, status=EvidenceStatus.PENDING).exists():
            return Response(
                {'detail': 'No pending evidence for this restaurant.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        restaurant.review_assigned_to = user
        restaurant.review_assigned_at = timezone.now()
        restaurant.save(update_fields=['review_assigned_to', 'review_assigned_at'])
        return Response({
            'detail': 'Work assigned.',
            'restaurant_id': restaurant.id,
            'restaurant_name': restaurant.name,
            'assigned_to_id': user.id,
            'assigned_to_name': user.name,
        }, status=status.HTTP_200_OK)


class SuperAdminReportView(APIView):
    """Super Admin: get completed scoring board for one restaurant (for report/print)."""
    permission_classes = [IsSuperAdmin]

    def get(self, request, restaurant_id):
        restaurant = get_object_or_404(Restaurant, pk=restaurant_id)
        score = restaurant.credibility_score
        breakdown = restaurant.score_breakdown or []
        last_audit = restaurant.last_audit_at
        has_any = any(
            (b.get('is_applicable') and b.get('score') is not None)
            for b in breakdown
        )
        badge = 'ADMIN_VERIFIED' if has_any else 'PROVISIONAL'
        return Response({
            'restaurant_id': restaurant.id,
            'restaurant_name': restaurant.name,
            'overall_score': float(score) if score is not None else None,
            'badge': badge,
            'last_audit_at': last_audit,
            'categories': breakdown,
        })
