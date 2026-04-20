from django.urls import path
from . import views

urlpatterns = [
    path('start/', views.start_stream, name='start_stream'),
    path('end/', views.end_stream, name='end_stream'),
    path('active/', views.get_active_streams, name='active_streams'),
    path('session/<str:session_code>/', views.get_stream_by_session, name='stream_by_session'),
]