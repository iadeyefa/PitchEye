from django.shortcuts import render
from utils.supabase_client import supabase
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['GET'])
def list_videos(request):
    data = supabase.table('video_clips').select('*').execute()
    return Response(data.data)

@api_view(['GET'])
def get_video(request, video_id): 
    data = supabase.table('video_clips').select('*').eq('id', video_id).execute()
    return Response(data.data)


"""
TODO: 
- Post Video
- Delete Video
"""