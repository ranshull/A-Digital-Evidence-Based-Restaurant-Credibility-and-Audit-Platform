from django.urls import path
from ..views.admin_views import (
    AdminOwnerApplicationListView,
    AdminOwnerApplicationDetailView,
    AdminApproveView,
    AdminRejectView,
    AdminPendingWorkView,
    AdminAcceptWorkView,
)

urlpatterns = [
    path('owner-applications/', AdminOwnerApplicationListView.as_view(), name='admin_owner_applications'),
    path('owner-applications/<int:pk>/', AdminOwnerApplicationDetailView.as_view(), name='admin_owner_application_detail'),
    path('owner-applications/<int:pk>/approve/', AdminApproveView.as_view(), name='admin_approve'),
    path('owner-applications/<int:pk>/reject/', AdminRejectView.as_view(), name='admin_reject'),
    path('pending-work/', AdminPendingWorkView.as_view(), name='admin_pending_work'),
    path('accept-work/<int:restaurant_id>/', AdminAcceptWorkView.as_view(), name='admin_accept_work'),
]
