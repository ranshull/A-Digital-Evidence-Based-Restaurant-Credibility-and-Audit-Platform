from django.urls import path
from ..views.audit_views import (
    OwnerRequestAuditWorkView,
    OwnerAuditWorkStatusView,
    OwnerRevokeAuditWorkView,
    AdminAuditWorkListView,
    AdminAcceptAuditWorkView,
    AdminAuditWorkDetailView,
)

urlpatterns = [
    path('owner/request/', OwnerRequestAuditWorkView.as_view(), name='owner_request_audit_work'),
    path('owner/status/', OwnerAuditWorkStatusView.as_view(), name='owner_audit_work_status'),
    path('owner/revoke/', OwnerRevokeAuditWorkView.as_view(), name='owner_revoke_audit_work'),
    path('admin/work/', AdminAuditWorkListView.as_view(), name='admin_audit_work_list'),
    path('admin/work/<int:work_item_id>/accept/', AdminAcceptAuditWorkView.as_view(), name='admin_audit_work_accept'),
    path('admin/work/<int:work_item_id>/', AdminAuditWorkDetailView.as_view(), name='admin_audit_work_detail'),
]

