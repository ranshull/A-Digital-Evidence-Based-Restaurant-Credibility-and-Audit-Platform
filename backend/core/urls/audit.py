from django.urls import path
from ..views.audit_views import (
    OwnerRequestAuditWorkView,
    OwnerAuditWorkStatusView,
    OwnerRevokeAuditWorkView,
    AdminAuditWorkListView,
    AdminAcceptAuditWorkView,
    AdminAuditWorkDetailView,
    AdminAuditWorkPhotosView,
    AdminAuditWorkPhotoDeleteView,
    AuditWorkSaveCategoryPhotosView,
    AuditWorkStagingScoresView,
    AuditWorkSubmitToAdminView,
)

urlpatterns = [
    path('owner/request/', OwnerRequestAuditWorkView.as_view(), name='owner_request_audit_work'),
    path('owner/status/', OwnerAuditWorkStatusView.as_view(), name='owner_audit_work_status'),
    path('owner/revoke/', OwnerRevokeAuditWorkView.as_view(), name='owner_revoke_audit_work'),
    path('admin/work/', AdminAuditWorkListView.as_view(), name='admin_audit_work_list'),
    path('admin/work/<int:work_item_id>/accept/', AdminAcceptAuditWorkView.as_view(), name='admin_audit_work_accept'),
    path(
        'admin/work/<int:work_item_id>/save-category-photos/',
        AuditWorkSaveCategoryPhotosView.as_view(),
        name='audit_work_save_category_photos',
    ),
    path(
        'admin/work/<int:work_item_id>/staging-scores/',
        AuditWorkStagingScoresView.as_view(),
        name='audit_work_staging_scores',
    ),
    path(
        'admin/work/<int:work_item_id>/submit-to-admin/',
        AuditWorkSubmitToAdminView.as_view(),
        name='audit_work_submit_to_admin',
    ),
    path(
        'admin/work/<int:work_item_id>/photos/<int:photo_id>/',
        AdminAuditWorkPhotoDeleteView.as_view(),
        name='admin_audit_work_photo_delete',
    ),
    path('admin/work/<int:work_item_id>/photos/', AdminAuditWorkPhotosView.as_view(), name='admin_audit_work_photos'),
    path('admin/work/<int:work_item_id>/', AdminAuditWorkDetailView.as_view(), name='admin_audit_work_detail'),
]

