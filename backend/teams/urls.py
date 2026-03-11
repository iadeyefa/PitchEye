# teams/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('list_teams/', views.list_teams),
    path('get_team/', views.get_team),
    path('create_team/', views.create_team),
    path('join/', views.join_team),
    path('my/', views.get_my_team),
    path('leave_team/', views.leave_team),
]