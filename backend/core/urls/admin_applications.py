from django.urls import path
from ..views.admin_views import (
    AdminOwnerApplicationListView,
    AdminOwnerApplicationDetailView,
    AdminApproveView,
    AdminRejectView,
    AdminPendingWorkView,
    AdminAcceptWorkView,
    AdminReviewReadinessView,
    AdminCompleteReviewView,
    AdminReviewHistoryView,
)
from ..views.auditor_evidence_admin_views import (
    AdminAuditorEvidenceListView,
    AdminAuditorEvidenceDetailView,
    AdminAuditorEvidenceApproveView,
    AdminAuditorEvidenceStagingScoresView,
    AdminAuditorEvidenceFlagView,
)

urlpatterns = [
    path('owner-applications/', AdminOwnerApplicationListView.as_view(), name='admin_owner_applications'),
    path('owner-applications/<int:pk>/', AdminOwnerApplicationDetailView.as_view(), name='admin_owner_application_detail'),
    path('owner-applications/<int:pk>/approve/', AdminApproveView.as_view(), name='admin_approve'),
    path('owner-applications/<int:pk>/reject/', AdminRejectView.as_view(), name='admin_reject'),
    path('pending-work/', AdminPendingWorkView.as_view(), name='admin_pending_work'),
    path('accept-work/<int:restaurant_id>/', AdminAcceptWorkView.as_view(), name='admin_accept_work'),
    path(
        'review-readiness/<int:restaurant_id>/',
        AdminReviewReadinessView.as_view(),
        name='admin_review_readiness',
    ),
    path(
        'complete-review/<int:restaurant_id>/',
        AdminCompleteReviewView.as_view(),
        name='admin_complete_review',
    ),
    path('review-history/', AdminReviewHistoryView.as_view(), name='admin_review_history'),
    path('auditor-evidence/', AdminAuditorEvidenceListView.as_view(), name='admin_auditor_evidence_list'),
    path(
        'auditor-evidence/<int:work_item_id>/',
        AdminAuditorEvidenceDetailView.as_view(),
        name='admin_auditor_evidence_detail',
    ),
    path(
        'auditor-evidence/<int:work_item_id>/approve/',
        AdminAuditorEvidenceApproveView.as_view(),
        name='admin_auditor_evidence_approve',
    ),
    path(
        'auditor-evidence/<int:work_item_id>/staging-scores/',
        AdminAuditorEvidenceStagingScoresView.as_view(),
        name='admin_auditor_evidence_staging_scores',
    ),
    path(
        'auditor-evidence/<int:work_item_id>/flag/',
        AdminAuditorEvidenceFlagView.as_view(),
        name='admin_auditor_evidence_flag',
    ),
]
