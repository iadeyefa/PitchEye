from django.urls import path
from . import views

urlpatterns = [
    path('', views.list_games),
    path('', views.get_game),
]
