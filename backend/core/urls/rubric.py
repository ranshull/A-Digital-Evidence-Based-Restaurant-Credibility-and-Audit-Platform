from django.urls import path
from ..views.rubric_views import RubricCategoryListView

urlpatterns = [
    path('categories/', RubricCategoryListView.as_view(), name='rubric_categories'),
]