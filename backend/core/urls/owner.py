from django.urls import path
from ..views.owner_views import OwnerApplyView, OwnerApplicationStatusView
from ..views.upload_views import FileUploadView
from ..views.feedback_views import OwnerPrivateFeedbackListView

urlpatterns = [
    path('apply/', OwnerApplyView.as_view(), name='owner_apply'),
    path('application-status/', OwnerApplicationStatusView.as_view(), name='owner_application_status'),
    path('upload/', FileUploadView.as_view(), name='file_upload'),
    path('feedback/', OwnerPrivateFeedbackListView.as_view(), name='owner_private_feedback_list'),
]
