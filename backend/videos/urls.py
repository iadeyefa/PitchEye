from django.urls import path
from . import views

urlpatterns = [
    path('', views.list_videos),
    path('feed/', views.list_team_feed),
    path('upload/', views.upload_video),
    path('<int:video_id>/comments/', views.video_comments),
    path('comments/<int:comment_id>/', views.delete_video_comment),
    path('game/<int:game_id>/', views.list_videos_for_game),
    path('<int:video_id>/', views.get_video),
    path('<int:video_id>/delete/', views.delete_video),
]
