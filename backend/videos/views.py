from django.shortcuts import render
from utils.supabase_client import supabase
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['GET'])
def list_videos(request):
    data = supabase.table('video_clips').select('*').execute()
    return Response(data.data)

