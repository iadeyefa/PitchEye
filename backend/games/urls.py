from django.urls import path
from . import views

urlpatterns = [
    path('', views.list_games),
    path('my/', views.list_my_games),
    path('attachable/', views.list_attachable_games),
    path('<int:id>/', views.get_game),
    path('create/', views.create_game),
    path('join/<str:session_code>/', views.get_game_by_session_code),
]
