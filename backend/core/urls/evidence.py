from django.urls import path
from ..views.evidence_views import (
    EvidenceUploadView,
    MyRestaurantEvidenceListView,
    EvidenceDetailView,
    EvidenceDeleteView,
    PendingEvidenceListView,
    EvidenceApproveView,
    EvidenceRejectView,
    EvidenceFlagView,
)

urlpatterns = [
    path('upload/', EvidenceUploadView.as_view(), name='evidence_upload'),
    path('my-restaurant/', MyRestaurantEvidenceListView.as_view(), name='evidence_my_restaurant'),
    path('pending/', PendingEvidenceListView.as_view(), name='evidence_pending'),
    path('<int:pk>/detail/', EvidenceDetailView.as_view(), name='evidence_detail'),
    path('<int:pk>/', EvidenceDeleteView.as_view(), name='evidence_delete'),
    path('<int:pk>/approve/', EvidenceApproveView.as_view(), name='evidence_approve'),
    path('<int:pk>/reject/', EvidenceRejectView.as_view(), name='evidence_reject'),
    path('<int:pk>/flag/', EvidenceFlagView.as_view(), name='evidence_flag'),
]