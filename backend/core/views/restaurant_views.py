from rest_framework import generics, permissions
from django.db.models import Q
from ..models import Restaurant, RestaurantPhoto
from ..serializers import (
    RestaurantSerializer,
    RestaurantPublicSerializer,
    RestaurantPhotoSerializer,
)
from ..permissions import IsOwner


class RestaurantListView(generics.ListAPIView):
    """Public list of active restaurants; search by name/address/city, filter by city."""
    serializer_class = RestaurantPublicSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Restaurant.objects.filter(status='ACTIVE').prefetch_related('photos').order_by('name')
        search = self.request.query_params.get('search', '').strip()
        city = self.request.query_params.get('city', '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(address__icontains=search) |
                Q(city__icontains=search)
            )
        if city:
            qs = qs.filter(city__icontains=city)
        return qs


class RestaurantDetailView(generics.RetrieveAPIView):
    """Public detail for a single active restaurant."""
    serializer_class = RestaurantPublicSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Restaurant.objects.filter(status='ACTIVE').prefetch_related('photos')


class MyRestaurantView(generics.RetrieveUpdateAPIView):
    """Owner: get or update their restaurant."""
    serializer_class = RestaurantSerializer
    permission_classes = [IsOwner]

    def get_queryset(self):
        return Restaurant.objects.prefetch_related('photos')

    def get_object(self):
        return self.get_queryset().get(owner=self.request.user)


class MyRestaurantPhotoCreateView(generics.CreateAPIView):
    """Owner: add a photo (image_url, caption, order)."""
    permission_classes = [IsOwner]
    serializer_class = RestaurantPhotoSerializer

    def get_serializer_context(self):
        restaurant = Restaurant.objects.get(owner=self.request.user)
        return {**super().get_serializer_context(), 'restaurant': restaurant}

    def perform_create(self, serializer):
        restaurant = Restaurant.objects.get(owner=self.request.user)
        serializer.save(restaurant=restaurant)


class MyRestaurantPhotoDeleteView(generics.DestroyAPIView):
    """Owner: delete a photo."""
    permission_classes = [IsOwner]

    def get_queryset(self):
        return RestaurantPhoto.objects.filter(restaurant__owner=self.request.user)
