from django.urls import path
from ..views.superadmin_views import (
    SuperAdminUserListView,
    SuperAdminUserDetailView,
    SuperAdminUserCreateView,
    SuperAdminLogsView,
    SuperAdminRollbackView,
    SuperAdminReportView,
    SuperAdminStaffWorkloadView,
    SuperAdminUnassignedWorkView,
    SuperAdminAssignWorkView,
)

urlpatterns = [
    path('users/', SuperAdminUserListView.as_view(), name='superadmin_user_list'),
    path('users/create/', SuperAdminUserCreateView.as_view(), name='superadmin_user_create'),
    path('users/<int:pk>/', SuperAdminUserDetailView.as_view(), name='superadmin_user_detail'),
    path('logs/', SuperAdminLogsView.as_view(), name='superadmin_logs'),
    path('rollback-restaurant/<int:restaurant_id>/', SuperAdminRollbackView.as_view(), name='superadmin_rollback'),
    path('report/<int:restaurant_id>/', SuperAdminReportView.as_view(), name='superadmin_report'),
    path('staff-workload/', SuperAdminStaffWorkloadView.as_view(), name='superadmin_staff_workload'),
    path('unassigned-work/', SuperAdminUnassignedWorkView.as_view(), name='superadmin_unassigned_work'),
    path('assign-work/', SuperAdminAssignWorkView.as_view(), name='superadmin_assign_work'),
]
