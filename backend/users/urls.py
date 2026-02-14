from django.urls import path
from . import views

urlpatterns = [
    path('', views.list_users),
    path('',views.get_user),
]
