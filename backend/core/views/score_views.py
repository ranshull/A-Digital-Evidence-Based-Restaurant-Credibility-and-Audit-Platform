from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied

from ..models import (
    Restaurant,
    Score,
    Evidence,
    RubricCategory,
    RubricSubCategory,
    EvidenceStatus,
    Audit,
    AuditStatus,
)
from ..serializers import ScoreSubmitSerializer
from ..permissions import IsOwnerWithRestaurant, IsAdminOrAuditor
from ..services.scoring import recompute_restaurant_scores
from ..services.improvement import get_improvement_suggestions


class ScoreSubmitView(APIView):
    """Admin/Auditor: submit scores for a category (overwrites existing for that category)."""
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def post(self, request):
        ser = ScoreSubmitSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        data = ser.validated_data
        restaurant_id = data['restaurant_id']
        category_id = data['category_id']
        is_applicable = data['is_category_applicable']
        subcategories_data = data['subcategories']

        restaurant = get_object_or_404(Restaurant, pk=restaurant_id)
        if restaurant.review_assigned_to_id and restaurant.review_assigned_to_id != request.user.id and request.user.role != 'SUPER_ADMIN':
            raise PermissionDenied('This restaurant is assigned to another user. Only they or Super Admin can submit scores.')
        category = get_object_or_404(RubricCategory, pk=category_id, is_active=True)

        # At least one approved evidence for this restaurant+category (unless marking N/A)
        if is_applicable:
            has_evidence = Evidence.objects.filter(
                restaurant=restaurant,
                category=category,
                status=EvidenceStatus.APPROVED,
            ).exists()
            if not has_evidence:
                return Response(
                    {'detail': 'Upload and approve evidence for this category before scoring.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Validate subcategory scores: 0-5, notes required for 0 or 1
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
            if item['score'] in (0, 1) and not (item.get('notes') or '').strip():
                return Response(
                    {'detail': f'Notes required when score is 0 or 1 for {sub.name}.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        with transaction.atomic():
            # Remove existing scores for this restaurant+category
            Score.objects.filter(restaurant=restaurant, category=category).delete()

            if is_applicable:
                for item in subcategories_data:
                    sub = subcats[item['subcategory_id']]
                    Score.objects.create(
                        restaurant=restaurant,
                        category=category,
                        subcategory=sub,
                        score=item['score'],
                        notes=(item.get('notes') or '').strip(),
                        scored_by=request.user,
                        is_category_applicable=True,
                    )

            recompute_restaurant_scores(restaurant.id)

        return Response(
            {'detail': 'Scores saved.', 'restaurant_id': restaurant_id},
            status=status.HTTP_200_OK,
        )


class RestaurantScorePublicView(APIView):
    """Public: get credibility score for a restaurant (for consumer view)."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        restaurant = get_object_or_404(Restaurant, pk=pk)
        score = restaurant.credibility_score
        breakdown = restaurant.score_breakdown or []
        last_audit = restaurant.last_audit_at
        has_any = any(
            (b.get('is_applicable') and b.get('score') is not None)
            for b in breakdown
        )
        # Badge precedence: AUDITOR_VERIFIED (if latest scores come from an approved audit),
        # otherwise ADMIN_VERIFIED if any category has a score, else PROVISIONAL.
        auditor_verified = Audit.objects.filter(
            restaurant=restaurant,
            status=AuditStatus.REVIEWED_BY_ADMIN,
        ).exists()
        if auditor_verified and has_any:
            badge = 'AUDITOR_VERIFIED'
        elif has_any:
            badge = 'ADMIN_VERIFIED'
        else:
            badge = 'PROVISIONAL'
        return Response({
            'restaurant_id': restaurant.id,
            'overall_score': float(score) if score is not None else None,
            'badge': badge,
            'last_audit_at': last_audit,
            'categories': breakdown,
        })


class MyRestaurantScoreView(APIView):
    """Owner: get score and evidence stats for their restaurant."""
    permission_classes = [IsAuthenticated, IsOwnerWithRestaurant]

    def get(self, request):
        restaurant = request.user.restaurant
        score = restaurant.credibility_score
        breakdown = restaurant.score_breakdown or []
        last_audit = restaurant.last_audit_at
        has_any = any(
            (b.get('is_applicable') and b.get('score') is not None)
            for b in breakdown
        )
        auditor_verified = Audit.objects.filter(
            restaurant=restaurant,
            status=AuditStatus.REVIEWED_BY_ADMIN,
        ).exists()
        if auditor_verified and has_any:
            badge = 'AUDITOR_VERIFIED'
        elif has_any:
            badge = 'ADMIN_VERIFIED'
        else:
            badge = 'PROVISIONAL'

        # Evidence counts by status
        evidence_qs = Evidence.objects.filter(restaurant=restaurant)
        evidence_counts = {
            'total': evidence_qs.count(),
            'pending': evidence_qs.filter(status=EvidenceStatus.PENDING).count(),
            'approved': evidence_qs.filter(status=EvidenceStatus.APPROVED).count(),
            'rejected': evidence_qs.filter(status=EvidenceStatus.REJECTED).count(),
            'flagged': evidence_qs.filter(status=EvidenceStatus.FLAGGED).count(),
        }

        suggestions = get_improvement_suggestions(restaurant)

        return Response({
            'restaurant_id': restaurant.id,
            'overall_score': float(score) if score is not None else None,
            'badge': badge,
            'last_audit_at': last_audit,
            'categories': breakdown,
            'evidence_counts': evidence_counts,
            'suggestions': suggestions,
        })