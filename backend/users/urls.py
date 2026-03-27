from django.urls import path
from . import views

urlpatterns = [
    path('list_users/', views.list_users),
    path('get_user/',views.get_user),
    path('create_user/',views.create_user),
    path('update_user/', views.update_user),

]
