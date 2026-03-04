from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from ..views.auth_views import CustomTokenObtainPairView, RegisterView, MeView

urlpatterns = [
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('register/', RegisterView.as_view(), name='register'),
    path('me/', MeView.as_view(), name='me'),
]
