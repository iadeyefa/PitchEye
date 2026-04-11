import os
import uuid
import requests
from datetime import datetime, timezone
from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response
from utils.supabase_client import supabase_admin
from utils.helpers import check_user


@api_view(['POST'])
def start_stream(request):
    user = check_user(request.headers.get('Authorization'))
    
    game_id = request.data.get('game_id')
    if not game_id:
        return Response({'error': 'game_id is required'}, status=400)
    
    game = supabase_admin.table('games').select('*').eq('id', game_id).execute()
    if not game.data:
        return Response({'error': 'Game not found'}, status=404)
    
    stream_key = f"{game.data[0]['session_code']}_{uuid.uuid4().hex[:8]}"
    
    stream_key_clean = stream_key.replace('-', '').lower()
    
    payload = {
        'session_code': game.data[0]['session_code'],
        'game_id': game_id,
        'stream_key': stream_key_clean,
        'host_user_id': str(user.id),
        'status': 'live',
        'rtmp_url': settings.RTMP_SERVER_URL,
        'hls_url': f"{settings.HLS_SERVER_URL}/{stream_key_clean}.m3u8",
        'started_at': datetime.now(timezone.utc).isoformat(),
    }
    
    data = supabase_admin.table('livestreams').insert(payload).execute()
    return Response(serialize_stream(data.data[0]), status=201)


@api_view(['POST'])
def end_stream(request):
    user = check_user(request.headers.get('Authorization'))
    
    stream_key = request.data.get('stream_key')
    if not stream_key:
        return Response({'error': 'stream_key is required'}, status=400)
    
    stream = supabase_admin.table('livestreams').select('*').eq('stream_key', stream_key).execute()
    if not stream.data:
        return Response({'error': 'Stream not found'}, status=404)
    
    if stream.data[0]['host_user_id'] != str(user.id):
        return Response({'error': 'Not authorized to end this stream'}, status=403)
    
    supabase_admin.table('livestreams').update({
        'status': 'ended',
        'ended_at': datetime.now(timezone.utc).isoformat(),
    }).eq('stream_key', stream_key).execute()
    
    return Response({'message': 'Stream ended successfully'})


@api_view(['GET'])
def get_active_streams(request):
    data = supabase_admin.table('livestreams').select('*').eq('status', 'live').execute()
    return Response([serialize_stream(s) for s in data.data])


@api_view(['GET'])
def get_stream_by_session(request, session_code):
    data = supabase_admin.table('livestreams').select('*').eq('session_code', session_code.upper()).eq('status', 'live').execute()
    if not data.data:
        return Response({'error': 'No active stream found for this session'}, status=404)
    return Response(serialize_stream(data.data[0]))


def serialize_stream(stream):
    return {
        'id': stream.get('id'),
        'session_code': stream.get('session_code'),
        'game_id': stream.get('game_id'),
        'stream_key': stream.get('stream_key'),
        'host_user_id': stream.get('host_user_id'),
        'status': stream.get('status'),
        'rtmp_url': stream.get('rtmp_url'),
        'hls_url': stream.get('hls_url'),
        'started_at': stream.get('started_at'),
        'ended_at': stream.get('ended_at'),
    }