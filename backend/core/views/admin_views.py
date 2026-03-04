from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from ..models import OwnerApplication, Restaurant, Evidence
from ..serializers import OwnerApplicationSerializer, OwnerApplicationListSerializer, AdminApproveRejectSerializer
from ..permissions import IsAdmin, IsAdminOrAuditor

User = get_user_model()

# Evidence status for pending work filter
PENDING_STATUS = 'PENDING'


class AdminOwnerApplicationListView(generics.ListAPIView):
    queryset = OwnerApplication.objects.all().select_related('user', 'reviewed_by')
    serializer_class = OwnerApplicationListSerializer
    permission_classes = [IsAdmin]


class AdminOwnerApplicationDetailView(generics.RetrieveAPIView):
    queryset = OwnerApplication.objects.all().select_related('user', 'reviewed_by')
    serializer_class = OwnerApplicationSerializer
    permission_classes = [IsAdmin]


class AdminApproveView(generics.GenericAPIView):
    queryset = OwnerApplication.objects.all().select_related('user')
    permission_classes = [IsAdmin]
    serializer_class = AdminApproveRejectSerializer

    def patch(self, request, pk):
        app = self.get_object()
        if app.status != 'PENDING':
            return Response(
                {'detail': f'Application is already {app.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = AdminApproveRejectSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        review_notes = serializer.validated_data.get('review_notes', '')

        app.status = 'APPROVED'
        app.review_notes = review_notes
        app.reviewed_by = request.user
        app.reviewed_at = timezone.now()
        app.save(update_fields=['status', 'review_notes', 'reviewed_by', 'reviewed_at'])

        user = app.user
        user.role = 'OWNER'
        user.save(update_fields=['role'])

        restaurant = Restaurant.objects.create(
            owner=user,
            name=app.restaurant_name,
            address=app.business_address,
            city=app.city,
            google_maps_link=app.google_maps_link,
            operating_hours=app.operating_hours or '',
            phone=app.contact_phone or '',
        )
        return Response({
            'application': OwnerApplicationSerializer(app).data,
            'restaurant': {'id': restaurant.id, 'name': restaurant.name},
        }, status=status.HTTP_200_OK)


class AdminRejectView(generics.GenericAPIView):
    queryset = OwnerApplication.objects.all()
    permission_classes = [IsAdmin]
    serializer_class = AdminApproveRejectSerializer

    def patch(self, request, pk):
        app = self.get_object()
        if app.status != 'PENDING':
            return Response(
                {'detail': f'Application is already {app.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = AdminApproveRejectSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        review_notes = serializer.validated_data.get('review_notes', '')

        app.status = 'REJECTED'
        app.review_notes = review_notes
        app.reviewed_by = request.user
        app.reviewed_at = timezone.now()
        app.save(update_fields=['status', 'review_notes', 'reviewed_by', 'reviewed_at'])

        return Response(OwnerApplicationSerializer(app).data, status=status.HTTP_200_OK)


class AdminPendingWorkView(APIView):
    """Admin/Auditor: list restaurants with pending evidence that are unassigned or assigned to me."""
    permission_classes = [IsAdminOrAuditor]

    def get(self, request):
        user = request.user
        # Restaurants that have at least one PENDING evidence and (unassigned or assigned to me)
        qs = Restaurant.objects.filter(
            evidence__status=PENDING_STATUS,
        ).filter(
            Q(review_assigned_to__isnull=True) | Q(review_assigned_to=user),
        ).distinct()
        result = []
        for r in qs:
            pending_count = Evidence.objects.filter(restaurant=r, status=PENDING_STATUS).count()
            result.append({
                'restaurant_id': r.id,
                'restaurant_name': r.name,
                'pending_count': pending_count,
                'is_assigned_to_me': r.review_assigned_to_id == user.id if r.review_assigned_to_id else False,
            })
        return Response(result)


class AdminAcceptWorkView(APIView):
    """Admin/Auditor: accept (claim) work for a restaurant; assigns it to current user."""
    permission_classes = [IsAdminOrAuditor]

    def post(self, request, restaurant_id):
        restaurant = Restaurant.objects.filter(pk=restaurant_id).first()
        if not restaurant:
            return Response({'detail': 'Restaurant not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not Evidence.objects.filter(restaurant=restaurant, status=PENDING_STATUS).exists():
            return Response({'detail': 'No pending evidence for this restaurant.'}, status=status.HTTP_400_BAD_REQUEST)
        if restaurant.review_assigned_to_id and restaurant.review_assigned_to_id != request.user.id:
            return Response({'detail': 'This work is already assigned to someone else.'}, status=status.HTTP_403_FORBIDDEN)
        restaurant.review_assigned_to = request.user
        restaurant.review_assigned_at = timezone.now()
        restaurant.save(update_fields=['review_assigned_to', 'review_assigned_at'])
        return Response({
            'detail': 'Work accepted.',
            'restaurant_id': restaurant.id,
            'restaurant_name': restaurant.name,
        }, status=status.HTTP_200_OK)
