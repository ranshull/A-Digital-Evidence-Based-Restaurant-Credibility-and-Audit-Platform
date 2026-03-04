from django.urls import path
from ..views.restaurant_views import (
    RestaurantListView,
    RestaurantDetailView,
    MyRestaurantView,
    MyRestaurantPhotoCreateView,
    MyRestaurantPhotoDeleteView,
)
from ..views.evidence_views import RestaurantEvidenceListView
from ..views.score_views import RestaurantScorePublicView

urlpatterns = [
    path('', RestaurantListView.as_view(), name='restaurant_list'),
    path('<int:pk>/', RestaurantDetailView.as_view(), name='restaurant_detail'),
    path('<int:pk>/evidence/', RestaurantEvidenceListView.as_view(), name='restaurant_evidence'),
    path('<int:pk>/score/', RestaurantScorePublicView.as_view(), name='restaurant_score'),
    path('me/', MyRestaurantView.as_view(), name='my_restaurant'),
    path('me/photos/', MyRestaurantPhotoCreateView.as_view(), name='my_restaurant_photo_create'),
    path('me/photos/<int:pk>/', MyRestaurantPhotoDeleteView.as_view(), name='my_restaurant_photo_delete'),
]
