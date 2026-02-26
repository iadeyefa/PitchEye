# teams/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('list_teams/', views.list_teams),
    path('get_team/', views.get_team),
    path('create_team/', views.create_team),  
]