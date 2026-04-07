from datetime import datetime, timezone
import json
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


def _normalize_tagged_players(value):
    if value in (None, ""):
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            parsed = [part.strip() for part in value.split(",")]
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    return []


def _enrich_clips(clips):
    serialized_clips = [_serialize_clip(clip) for clip in clips]
    if not serialized_clips:
        return []

    uploaded_by_ids = list({clip.get("uploaded_by") for clip in serialized_clips if clip.get("uploaded_by")})
    game_ids = list({clip.get("game_id") for clip in serialized_clips if clip.get("game_id") is not None})

    profiles_by_id = {}
    games_by_id = {}

    if uploaded_by_ids:
        profiles = supabase_admin.table('profiles').select('id, username, email, team_id').in_('id', uploaded_by_ids).execute().data
        profiles_by_id = {profile['id']: profile for profile in profiles}

    if game_ids:
        games = supabase_admin.table('games').select('*').in_('id', game_ids).execute().data
        games_by_id = {game['id']: game for game in games}

    enriched = []
    for clip in serialized_clips:
        profile = profiles_by_id.get(clip.get("uploaded_by"))
        game = games_by_id.get(clip.get("game_id"))
        username = (
            (profile or {}).get("username")
            or ((profile or {}).get("email") or "teammate").split("@")[0]
        )

        clip["tagged_players"] = _normalize_tagged_players(clip.get("tagged_players"))
        clip["caption"] = (clip.get("caption") or "").strip()
        clip["uploader"] = {
            "id": clip.get("uploaded_by"),
            "username": username,
            "email": (profile or {}).get("email"),
            "team_id": (profile or {}).get("team_id"),
        }
        clip["game"] = serialize_game(game) if game else None
        clip["game_title"] = game.get("title") if game else None
        enriched.append(clip)

    return enriched


def _get_team_member_ids_for_user(user):
    profile = supabase_admin.table('profiles').select('team_id').eq('id', str(user.id)).execute()
    team_id = profile.data[0].get('team_id') if profile.data else None
    if not team_id:
        return [], None

    members = supabase_admin.table('profiles').select('id').eq('team_id', team_id).execute().data
    member_ids = [member['id'] for member in members if member.get('id')]
    return member_ids, team_id

@api_view(['GET'])
def list_videos(request):
    data = supabase.table('video_clips').select('*').execute()
    return Response([_serialize_clip(clip) for clip in data.data])

@api_view(['GET'])
def get_video(request, video_id): 
    user = check_user(request.headers.get('Authorization'))
    member_ids, team_id = _get_team_member_ids_for_user(user)

    if not team_id or not member_ids:
        return Response({'error': 'Video not found'}, status=404)

    data = (
        supabase_admin
        .table('video_clips')
        .select('*')
        .eq('id', video_id)
        .in_('uploaded_by', member_ids)
        .execute()
    )
    if not data.data:
        return Response({'error': 'Video not found'}, status=404)
    return Response(_enrich_clips(data.data)[0])


@api_view(['GET'])
def list_videos_for_game(request, game_id):
    data = supabase_admin.table('video_clips').select('*').eq('game_id', game_id).order('uploaded_at', desc=True).execute()
    return Response([_serialize_clip(clip) for clip in data.data])


@api_view(['GET'])
def list_team_feed(request):
    user = check_user(request.headers.get('Authorization'))
    member_ids, team_id = _get_team_member_ids_for_user(user)

    if not team_id or not member_ids:
        return Response([])

    data = supabase_admin.table('video_clips').select('*').in_('uploaded_by', member_ids).order('uploaded_at', desc=True).execute()
    return Response(_enrich_clips(data.data))


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
    serialized = _enrich_clips([clip])[0]
    serialized['game_title'] = game.data[0].get('title')
    serialized['game'] = serialize_game(game.data[0])
    serialized['original_filename'] = video.name
    return Response(serialized, status=201)


"""
TODO: 
- Post Video
- Delete Video
"""
