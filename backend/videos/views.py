from datetime import datetime, timezone
import json
import os
import time
import uuid
import requests as _requests
from utils.supabase_client import supabase, supabase_admin
from rest_framework.decorators import api_view
from rest_framework.response import Response
from utils.helpers import check_user
from games.views import has_session_started, is_qr_code_active, serialize_game

VIDEO_BUCKET = os.getenv("SUPABASE_VIDEO_BUCKET", "match-videos")


class _FallbackResponse:
    def __init__(self, data=None):
        self.data = data or []


def _execute_query(query_factory, fallback=None, attempts=3, delay=0.15):
    last_error = None

    for attempt in range(attempts):
        try:
            return query_factory().execute()
        except Exception as exc:
            last_error = exc
            if attempt == attempts - 1:
                break
            time.sleep(delay * (attempt + 1))

    if fallback is not None:
        return fallback
    raise last_error


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


def _is_legacy_stream_archive(clip):
    device_id = str(clip.get("device_id") or "")
    video_url = str(clip.get("video_url") or "")
    return (
        device_id.startswith("livestream:")
        and video_url.startswith(("http://", "https://"))
        and ".m3u8" in video_url.lower()
    )


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


def _normalize_comment_body(value):
    return str(value or "").strip()


def _get_profiles_map(user_ids):
    clean_ids = [user_id for user_id in user_ids if user_id]
    if not clean_ids:
        return {}

    profiles = _execute_query(
        lambda: (
            supabase_admin
            .table('profiles')
            .select('id, username, email, team_id')
            .in_('id', list(set(clean_ids)))
        ),
        fallback=_FallbackResponse([]),
    ).data
    return {profile['id']: profile for profile in profiles}


def _serialize_comment(comment, profiles_by_id):
    profile = profiles_by_id.get(comment.get("user_id"))
    username = (
        (profile or {}).get("username")
        or ((profile or {}).get("email") or "teammate").split("@")[0]
    )

    return {
        "id": comment.get("id"),
        "video_id": comment.get("video_id"),
        "user_id": comment.get("user_id"),
        "parent_comment_id": comment.get("parent_comment_id"),
        "body": _normalize_comment_body(comment.get("body")),
        "created_at": comment.get("created_at"),
        "user": {
            "id": comment.get("user_id"),
            "username": username,
            "email": (profile or {}).get("email"),
        },
        "replies": [],
    }


def _nest_comments(serialized_comments):
    comments_by_id = {comment["id"]: comment for comment in serialized_comments}
    root_comments = []

    for comment in serialized_comments:
        parent_comment_id = comment.get("parent_comment_id")
        if parent_comment_id and parent_comment_id in comments_by_id:
            comments_by_id[parent_comment_id]["replies"].append(comment)
        else:
            root_comments.append(comment)

    return root_comments


def _get_comments_for_video_ids(video_ids):
    clean_ids = [video_id for video_id in video_ids if video_id is not None]
    if not clean_ids:
        return {}

    comments = _execute_query(
        lambda: (
            supabase_admin
            .table('comments')
            .select('*')
            .in_('video_id', list(set(clean_ids)))
            .order('created_at', desc=False)
        ),
        fallback=_FallbackResponse([]),
    ).data
    profiles_by_id = _get_profiles_map([comment.get("user_id") for comment in comments])
    grouped_comments = {video_id: [] for video_id in clean_ids}
    for comment in comments:
        grouped_comments.setdefault(comment.get("video_id"), []).append(_serialize_comment(comment, profiles_by_id))
    return {
        video_id: _nest_comments(video_comments)
        for video_id, video_comments in grouped_comments.items()
    }


def _count_comments(comments):
    total = 0
    for comment in comments:
        total += 1 + _count_comments(comment.get("replies", []))
    return total


def _enrich_clips(clips):
    serialized_clips = [_serialize_clip(clip) for clip in clips]
    if not serialized_clips:
        return []

    uploaded_by_ids = list({clip.get("uploaded_by") for clip in serialized_clips if clip.get("uploaded_by")})
    game_ids = list({clip.get("game_id") for clip in serialized_clips if clip.get("game_id") is not None})
    clip_ids = list({clip.get("id") for clip in serialized_clips if clip.get("id") is not None})

    profiles_by_id = {}
    games_by_id = {}
    comments_by_video_id = {}

    if uploaded_by_ids:
        profiles_by_id = _get_profiles_map(uploaded_by_ids)

    if game_ids:
        games = _execute_query(
            lambda: supabase_admin.table('games').select('*').in_('id', game_ids),
            fallback=_FallbackResponse([]),
        ).data
        games_by_id = {game['id']: game for game in games}

    if clip_ids:
        comments_by_video_id = _get_comments_for_video_ids(clip_ids)

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
        clip["comments"] = comments_by_video_id.get(clip.get("id"), [])
        clip["comment_count"] = _count_comments(clip["comments"])
        enriched.append(clip)

    return enriched


def _get_team_member_ids_for_user(user):
    profile = _execute_query(
        lambda: supabase_admin.table('profiles').select('team_id').eq('id', str(user.id)),
        fallback=_FallbackResponse([]),
    )
    team_id = profile.data[0].get('team_id') if profile.data else None
    if not team_id:
        return [], None

    members = _execute_query(
        lambda: supabase_admin.table('profiles').select('id').eq('team_id', team_id),
        fallback=_FallbackResponse([]),
    ).data
    member_ids = [member['id'] for member in members if member.get('id')]
    return member_ids, team_id


def _get_team_video_for_user(user, video_id):
    member_ids, team_id = _get_team_member_ids_for_user(user)
    if not team_id or not member_ids:
        return None, member_ids, team_id

    data = _execute_query(
        lambda: (
            supabase_admin
            .table('video_clips')
            .select('*')
            .eq('id', video_id)
            .in_('uploaded_by', member_ids)
        ),
        fallback=_FallbackResponse([]),
    )
    return (data.data[0] if data.data else None), member_ids, team_id

@api_view(['GET'])
def list_videos(request):
    data = _execute_query(
        lambda: supabase.table('video_clips').select('*'),
        fallback=_FallbackResponse([]),
    )
    return Response([_serialize_clip(clip) for clip in data.data])

@api_view(['GET'])
def get_video(request, video_id): 
    user = check_user(request.headers.get('Authorization'))
    video, _member_ids, _team_id = _get_team_video_for_user(user, video_id)
    if not video:
        return Response({'error': 'Video not found'}, status=404)
    return Response(_enrich_clips([video])[0])


@api_view(['GET'])
def list_videos_for_game(request, game_id):
    data = _execute_query(
        lambda: supabase_admin.table('video_clips').select('*').eq('game_id', game_id).order('uploaded_at', desc=True),
        fallback=_FallbackResponse([]),
    )
    return Response([_serialize_clip(clip) for clip in data.data])


@api_view(['GET'])
def list_team_feed(request):
    user = check_user(request.headers.get('Authorization'))
    member_ids, team_id = _get_team_member_ids_for_user(user)

    if not team_id or not member_ids:
        return Response([])

    data = _execute_query(
        lambda: supabase_admin.table('video_clips').select('*').in_('uploaded_by', member_ids).order('uploaded_at', desc=True),
        fallback=_FallbackResponse([]),
    )
    playable_clips = [clip for clip in data.data if not _is_legacy_stream_archive(clip)]
    return Response(_enrich_clips(playable_clips))


@api_view(['POST'])
def upload_video(request):
    user = check_user(request.headers.get('Authorization'))
    game_id = request.data.get('game_id')
    video = request.FILES.get('video')

    print(f"[upload] game_id={game_id} video={getattr(video, 'name', None)} bucket={VIDEO_BUCKET}")

    if not game_id:
        return Response({'error': 'Session selection is required'}, status=400)
    if not video:
        return Response({'error': 'Video file is required'}, status=400)

    game = supabase_admin.table('games').select('*').eq('id', game_id).execute()
    if not game.data:
        return Response({'error': 'Selected session was not found'}, status=404)
    if not is_qr_code_active(game.data[0]):
        return Response({'error': 'You cannot upload clips to a session that is no longer active'}, status=400)
    if not has_session_started(game.data[0]):
        return Response({'error': 'You cannot upload clips to a session that has not started yet'}, status=400)

    content_type = getattr(video, 'content_type', None) or 'video/mp4'
    extension = os.path.splitext(video.name)[1] or '.mp4'
    file_path = f"{user.id}/{game_id}/{uuid.uuid4().hex}{extension}"
    print(f"[upload] reading file...")
    video_bytes = video.read()
    print(f"[upload] file read: {len(video_bytes)} bytes — uploading to Supabase storage...")

    try:
        _supabase_url = os.getenv('SUPABASE_URL', '').rstrip('/')
        _service_key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_KEY', '')
        _upload_url = f"{_supabase_url}/storage/v1/object/{VIDEO_BUCKET}/{file_path}"
        _resp = _requests.post(
            _upload_url,
            headers={
                'Authorization': f'Bearer {_service_key}',
                'Content-Type': content_type,
            },
            data=video_bytes,
            timeout=300,
        )
        if _resp.status_code == 404:
            return Response(
                {'error': f'Storage bucket "{VIDEO_BUCKET}" was not found. Set SUPABASE_VIDEO_BUCKET to an existing bucket name.'},
                status=500,
            )
        if not _resp.ok:
            return Response({'error': f'Failed to store video: {_resp.text}'}, status=500)
        print(f"[upload] storage upload done — inserting into video_clips...")
    except Exception as exc:
        return Response({'error': f'Failed to store video: {exc}'}, status=500)

    caption = (request.data.get('caption') or '').strip()
    tagged_players = _normalize_tagged_players(request.data.get('tagged_players'))

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
        'caption': caption,
        'tagged_players': tagged_players,
        'is_processed': False,
    }

    inserted = supabase_admin.table('video_clips').insert(payload).execute()
    clip = inserted.data[0]
    serialized = _enrich_clips([clip])[0]
    serialized['game_title'] = game.data[0].get('title')
    serialized['game'] = serialize_game(game.data[0])
    serialized['original_filename'] = video.name
    return Response(serialized, status=201)


@api_view(['GET', 'POST'])
def video_comments(request, video_id):
    user = check_user(request.headers.get('Authorization'))
    video, member_ids, team_id = _get_team_video_for_user(user, video_id)
    if not video or not team_id or not member_ids:
        return Response({'error': 'Video not found'}, status=404)

    if request.method == 'GET':
        comments = _get_comments_for_video_ids([video_id]).get(video_id, [])
        return Response(comments)

    body = _normalize_comment_body(request.data.get('body'))
    parent_comment_id = request.data.get('parent_comment_id')
    if not body:
        return Response({'error': 'Comment cannot be empty'}, status=400)
    if len(body) > 1000:
        return Response({'error': 'Comment must be 1000 characters or fewer'}, status=400)

    parent_comment = None
    if parent_comment_id not in (None, ""):
        parent_response = (
            supabase_admin
            .table('comments')
            .select('*')
            .eq('id', parent_comment_id)
            .eq('video_id', video_id)
            .execute()
        )
        if not parent_response.data:
            return Response({'error': 'Parent comment not found'}, status=404)

        parent_comment = parent_response.data[0]
        if parent_comment.get('parent_comment_id'):
            return Response({'error': 'Replies can only be added to top-level comments'}, status=400)

    inserted = (
        supabase_admin
        .table('comments')
        .insert({
            'video_id': int(video_id),
            'user_id': str(user.id),
            'body': body,
            'parent_comment_id': int(parent_comment_id) if parent_comment_id not in (None, "") else None,
        })
        .execute()
    )
    profiles_by_id = _get_profiles_map([str(user.id)])
    return Response(_serialize_comment(inserted.data[0], profiles_by_id), status=201)


@api_view(['DELETE'])
def delete_video_comment(request, comment_id):
    user = check_user(request.headers.get('Authorization'))

    comment = supabase_admin.table('comments').select('*').eq('id', comment_id).execute()
    if not comment.data:
        return Response({'error': 'Comment not found'}, status=404)

    comment_row = comment.data[0]
    video, member_ids, team_id = _get_team_video_for_user(user, comment_row.get('video_id'))
    if not video or not team_id or not member_ids:
        return Response({'error': 'Comment not found'}, status=404)
    if comment_row.get('user_id') != str(user.id):
        return Response({'error': 'Not authorized to delete this comment'}, status=403)

    supabase_admin.table('comments').delete().eq('id', comment_id).execute()
    return Response({'message': 'Comment deleted'})


@api_view(['DELETE'])
def delete_video(request, video_id):
    user = check_user(request.headers.get('Authorization'))

    # Check the user's role
    profile = _execute_query(
        lambda: supabase_admin.table('profiles').select('role, team_id').eq('id', str(user.id)),
        fallback=_FallbackResponse([]),
    )
    if not profile.data:
        return Response({'error': 'User not found'}, status=404)

    user_role = profile.data[0].get('role')
    user_team_id = profile.data[0].get('team_id')

    if user_role not in ('admin', 'coach'):
        return Response({'error': 'Not authorized to delete clips'}, status=403)

    # Fetch the clip and verify it belongs to the same team
    member_ids, team_id = _get_team_member_ids_for_user(user)
    if not team_id or not member_ids:
        return Response({'error': 'Video not found'}, status=404)

    clip_data = _execute_query(
        lambda: (
            supabase_admin
            .table('video_clips')
            .select('*')
            .eq('id', video_id)
            .in_('uploaded_by', member_ids)
        ),
        fallback=_FallbackResponse([]),
    )
    if not clip_data.data:
        return Response({'error': 'Video not found'}, status=404)

    clip = clip_data.data[0]

    # Delete the file from storage if it is a stored path (not an external URL)
    video_path = clip.get('video_url')
    if video_path and not video_path.startswith(('http://', 'https://')):
        try:
            supabase_admin.storage.from_(VIDEO_BUCKET).remove([video_path])
        except Exception:
            pass  # Don't block deletion if storage removal fails

    # Delete comments then the clip row
    supabase_admin.table('comments').delete().eq('video_id', video_id).execute()
    supabase_admin.table('video_clips').delete().eq('id', video_id).execute()

    return Response({'message': 'Clip deleted'})
