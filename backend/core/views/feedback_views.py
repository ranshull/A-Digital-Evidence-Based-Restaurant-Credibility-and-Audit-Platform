from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.utils import OperationalError

from ..models import Restaurant, RestaurantPrivateFeedback, RestaurantStatus
from ..permissions import IsOwnerWithRestaurant


class RestaurantPrivateFeedbackCreateView(APIView):
    """Authenticated users post private feedback; not exposed on public restaurant payload."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        restaurant = get_object_or_404(Restaurant, pk=pk)
        if restaurant.status != RestaurantStatus.ACTIVE:
            return Response({'detail': 'Restaurant not found.'}, status=status.HTTP_404_NOT_FOUND)
        user = request.user
        if getattr(user, 'restaurant', None) and user.restaurant.id == restaurant.id:
            return Response(
                {'detail': 'You cannot send private feedback to your own restaurant.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        message = (request.data.get('message') or '').strip()
        if len(message) < 5:
            return Response(
                {'detail': 'Please write at least a few words (5 characters minimum).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(message) > 2000:
            return Response(
                {'detail': 'Message is too long (maximum 2000 characters).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            RestaurantPrivateFeedback.objects.create(
                restaurant=restaurant,
                author=user,
                message=message,
            )
        except OperationalError:
            return Response(
                {
                    'detail': 'Private feedback is not ready yet. Please run database migrations and try again.',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(
            {
                'detail': 'Your feedback was sent privately to the restaurant. It is not shown on this public page.',
            },
            status=status.HTTP_201_CREATED,
        )


class OwnerPrivateFeedbackListView(APIView):
    """Owner: list private feedback for their restaurant."""

    permission_classes = [IsAuthenticated, IsOwnerWithRestaurant]

    def get(self, request):
        restaurant = request.user.restaurant
        try:
            rows = (
                RestaurantPrivateFeedback.objects.filter(restaurant=restaurant)
                .select_related('author')
                .order_by('-created_at')
            )
            data = [
                {
                    'id': f.id,
                    'message': f.message,
                    'author_name': f.author.name,
                    'author_email': f.author.email,
                    'created_at': f.created_at,
                }
                for f in rows
            ]
            return Response(data)
        except OperationalError:
            return Response(
                {'detail': 'Private feedback is not ready yet. Please run database migrations and try again.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
