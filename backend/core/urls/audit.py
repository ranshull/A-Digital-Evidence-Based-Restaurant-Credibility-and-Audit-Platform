from django.urls import path

from ..views.audit_views import (
    OwnerAuditRequestView,
    AuditorMyAuditsListView,
    AuditorAuditDetailView,
    AuditorStartAuditView,
    AuditorEvidenceUploadView,
    AuditorEvidenceListView,
    AuditorScoreSubmitView,
    AuditorSubmitAuditView,
    AdminPendingAuditsView,
    AdminAuditDetailView,
    AdminAuditEvidenceListView,
    AdminAuditApproveView,
    AdminAuditRejectView,
    SuperAdminAuditListView,
    SuperAdminAuditAssignView,
)


urlpatterns = [
    # Owner
    path('owner/request/', OwnerAuditRequestView.as_view(), name='owner_audit_request'),

    # Auditor
    path('auditor/my/', AuditorMyAuditsListView.as_view(), name='auditor_my_audits'),
    path('auditor/<int:pk>/', AuditorAuditDetailView.as_view(), name='auditor_audit_detail'),
    path('auditor/<int:pk>/start/', AuditorStartAuditView.as_view(), name='auditor_start_audit'),
    path('auditor/<int:pk>/evidence/', AuditorEvidenceListView.as_view(), name='auditor_audit_evidence_list'),
    path('auditor/<int:pk>/evidence/upload/', AuditorEvidenceUploadView.as_view(), name='auditor_audit_evidence_upload'),
    path('auditor/score/submit/', AuditorScoreSubmitView.as_view(), name='auditor_score_submit'),
    path('auditor/<int:pk>/submit/', AuditorSubmitAuditView.as_view(), name='auditor_submit_audit'),

    # Admin
    path('admin/pending/', AdminPendingAuditsView.as_view(), name='admin_pending_audits'),
    path('admin/<int:pk>/', AdminAuditDetailView.as_view(), name='admin_audit_detail'),
    path('admin/<int:pk>/evidence/', AdminAuditEvidenceListView.as_view(), name='admin_audit_evidence'),
    path('admin/<int:pk>/approve/', AdminAuditApproveView.as_view(), name='admin_audit_approve'),
    path('admin/<int:pk>/reject/', AdminAuditRejectView.as_view(), name='admin_audit_reject'),

    # Super Admin
    path('superadmin/', SuperAdminAuditListView.as_view(), name='superadmin_audit_list'),
    path('superadmin/<int:pk>/assign/', SuperAdminAuditAssignView.as_view(), name='superadmin_audit_assign'),
]

