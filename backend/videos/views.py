from datetime import datetime, timezone
import os
import uuid
from utils.supabase_client import supabase, supabase_admin
from rest_framework.decorators import api_view
from rest_framework.response import Response
from storage3.exceptions import StorageApiError
from utils.helpers import check_user
from games.views import has_session_started, is_qr_code_active, serialize_game

VIDEO_BUCKET = os.getenv("SUPABASE_VIDEO_BUCKET", "match-videos")


def _optional_float(value):
    if value in (None, ""):
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _sign_video_url(video_path):
    if not video_path:
        return video_path
    if video_path.startswith("http://") or video_path.startswith("https://"):
        return video_path

    signed = supabase_admin.storage.from_(VIDEO_BUCKET).create_signed_url(
        video_path,
        expires_in=604800,
    )
    return signed.get("signedURL") or signed.get("signed_url") or video_path


def _serialize_clip(clip):
    serialized = dict(clip)
    serialized["storage_path"] = clip.get("video_url")
    serialized["video_url"] = _sign_video_url(clip.get("video_url"))
    return serialized

@api_view(['GET'])
def list_videos(request):
    data = supabase.table('video_clips').select('*').execute()
    return Response([_serialize_clip(clip) for clip in data.data])

@api_view(['GET'])
def get_video(request, video_id): 
    data = supabase.table('video_clips').select('*').eq('id', video_id).execute()
    return Response([_serialize_clip(clip) for clip in data.data])


@api_view(['GET'])
def list_videos_for_game(request, game_id):
    data = supabase_admin.table('video_clips').select('*').eq('game_id', game_id).order('uploaded_at', desc=True).execute()
    return Response([_serialize_clip(clip) for clip in data.data])


@api_view(['POST'])
def upload_video(request):
    user = check_user(request.headers.get('Authorization'))
    game_id = request.data.get('game_id')
    video = request.FILES.get('video')

    if not game_id:
        return Response({'error': 'Session selection is required'}, status=400)
    if not video:
        return Response({'error': 'Video file is required'}, status=400)

    game = supabase_admin.table('games').select('*').eq('id', game_id).execute()
    if not game.data:
        return Response({'error': 'Selected session was not found'}, status=404)
    if not is_qr_code_active(game.data[0]):
        return Response({'error': 'You cannot upload clips to a session whose QR code has expired'}, status=400)
    if not has_session_started(game.data[0]):
        return Response({'error': 'You cannot upload clips to a session that has not started yet'}, status=400)

    content_type = getattr(video, 'content_type', None) or 'video/mp4'
    extension = os.path.splitext(video.name)[1] or '.mp4'
    file_path = f"{user.id}/{game_id}/{uuid.uuid4().hex}{extension}"
    video_bytes = video.read()

    try:
        supabase_admin.storage.from_(VIDEO_BUCKET).upload(
            file_path,
            video_bytes,
            file_options={"content-type": content_type},
        )
    except StorageApiError as exc:
        exc_message = str(exc)
        if "Bucket not found" in exc_message:
            return Response(
                {'error': f'Storage bucket "{VIDEO_BUCKET}" was not found. Set SUPABASE_VIDEO_BUCKET to an existing bucket name.'},
                status=500,
            )
        return Response({'error': f'Failed to store video: {exc_message}'}, status=500)
    except Exception as exc:
        return Response({'error': f'Failed to store video: {exc}'}, status=500)

    payload = {
        'game_id': int(game_id),
        'uploaded_by': str(user.id),
        'video_url': file_path,
        'file_size': len(video_bytes),
        'device_id': request.data.get('device_id') or 'web-upload',
        'device_name': request.data.get('device_name') or 'Web Upload',
        'recorded_at': request.data.get('recorded_at') or datetime.now(timezone.utc).isoformat(),
        'duration': _optional_float(request.data.get('duration')),
        'time_offset': _optional_float(request.data.get('time_offset')),
        'start_time': _optional_float(request.data.get('start_time')),
        'end_time': _optional_float(request.data.get('end_time')),
        'is_processed': False,
    }

    inserted = supabase_admin.table('video_clips').insert(payload).execute()
    clip = inserted.data[0]
    serialized = _serialize_clip(clip)
    serialized['game_title'] = game.data[0].get('title')
    serialized['game'] = serialize_game(game.data[0])
    serialized['original_filename'] = video.name
    return Response(serialized, status=201)


"""
TODO: 
- Post Video
- Delete Video
"""
