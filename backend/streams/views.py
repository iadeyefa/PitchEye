import os
import subprocess
import tempfile
import uuid
import requests
from datetime import datetime, timezone
from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response
from storage3.exceptions import StorageApiError
from utils.supabase_client import supabase_admin
from utils.helpers import check_user

VIDEO_BUCKET = os.getenv("SUPABASE_VIDEO_BUCKET", "match-videos")


def _archive_stream_recording(stream_row, user_id):
    hls_url = stream_row.get('hls_url')
    game_id = stream_row.get('game_id')
    stream_key = stream_row.get('stream_key')
    if not hls_url or not game_id or not stream_key:
        return None, 0, 'Missing stream archive details'

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_file:
            temp_path = temp_file.name

        command = [
            'ffmpeg',
            '-y',
            '-i',
            hls_url,
            '-c',
            'copy',
            '-bsf:a',
            'aac_adtstoasc',
            '-movflags',
            '+faststart',
            temp_path,
        ]
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=300,
            check=False,
        )
        if completed.returncode != 0:
            error_output = completed.stderr.strip() or completed.stdout.strip() or 'ffmpeg archive failed'
            return None, 0, error_output

        file_size = os.path.getsize(temp_path)
        if file_size <= 0:
            return None, 0, 'Archived recording file was empty'

        file_path = f"{user_id}/{game_id}/livestreams/{stream_key}.mp4"
        with open(temp_path, 'rb') as archived_video:
            supabase_admin.storage.from_(VIDEO_BUCKET).upload(
                file_path,
                archived_video.read(),
                file_options={"content-type": "video/mp4", "upsert": "true"},
            )

        return file_path, file_size, None
    except subprocess.TimeoutExpired:
        return None, 0, 'Timed out while archiving stream recording'
    except StorageApiError as exc:
        return None, 0, f'Failed to store archived stream: {exc}'
    except Exception as exc:
        return None, 0, f'Failed to archive stream: {exc}'
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


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

    stream_row = stream.data[0]

    supabase_admin.table('livestreams').update({
        'status': 'ended',
        'ended_at': datetime.now(timezone.utc).isoformat(),
    }).eq('stream_key', stream_key).execute()

    existing_clip = (
        supabase_admin
        .table('video_clips')
        .select('id, video_url')
        .eq('device_id', f"livestream:{stream_key}")
        .execute()
    )

    archive_path, archive_file_size, archive_error = _archive_stream_recording(stream_row, str(user.id))
    if archive_path:
        started_at = stream_row.get('started_at') or datetime.now(timezone.utc).isoformat()
        ended_at = datetime.now(timezone.utc).isoformat()
        payload = {
            'game_id': stream_row.get('game_id'),
            'uploaded_by': str(user.id),
            'video_url': archive_path,
            'file_size': archive_file_size,
            'device_id': f"livestream:{stream_key}",
            'device_name': 'Livestream Archive',
            'recorded_at': started_at,
            'is_processed': False,
        }
        if stream_row.get('started_at'):
            try:
                duration = (
                    datetime.fromisoformat(ended_at.replace('Z', '+00:00'))
                    - datetime.fromisoformat(stream_row['started_at'].replace('Z', '+00:00'))
                ).total_seconds()
                payload['duration'] = max(duration, 0)
            except ValueError:
                pass

        if existing_clip.data:
            supabase_admin.table('video_clips').update(payload).eq('id', existing_clip.data[0]['id']).execute()
        else:
            supabase_admin.table('video_clips').insert(payload).execute()

        return Response({'message': 'Stream ended successfully', 'archive_created': True})

    return Response({
        'message': 'Stream ended successfully, but the recording could not be archived yet',
        'archive_created': False,
        'archive_error': archive_error,
    })


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
