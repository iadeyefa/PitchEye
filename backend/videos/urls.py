from django.urls import path
from . import views

urlpatterns = [
    path('', views.list_videos),
    path('upload/', views.upload_video),
    path('game/<int:game_id>/', views.list_videos_for_game),
    path('<int:video_id>/', views.get_video),
]
