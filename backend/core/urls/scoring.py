from django.urls import path
from ..views.score_views import ScoreSubmitView, MyRestaurantScoreView

urlpatterns = [
    path('submit/', ScoreSubmitView.as_view(), name='score_submit'),
    path('my-restaurant/', MyRestaurantScoreView.as_view(), name='score_my_restaurant'),
]