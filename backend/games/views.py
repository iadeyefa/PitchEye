import time
from datetime import datetime, timedelta, timezone
from postgrest.exceptions import APIError
from django.shortcuts import render
from utils.supabase_client import supabase, supabase_admin
from rest_framework.decorators import api_view
from rest_framework.response import Response
from utils.helpers import check_user
from utils.qr_generator import generate_session_code, generate_qr_code, check_session_code_exists

QR_CODE_TTL = timedelta(days=1)
QR_STORAGE_BUCKET = 'qr-codes'
SESSION_CREATION_ACCESS_OWNER = 'owner_only'
SESSION_CREATION_ACCESS_STAFF = 'staff_only'
SESSION_CREATION_ACCESS_ALL = 'all_members'
VALID_SESSION_CREATION_ACCESS = {
    SESSION_CREATION_ACCESS_OWNER,
    SESSION_CREATION_ACCESS_STAFF,
    SESSION_CREATION_ACCESS_ALL,
}


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


def _normalize_session_creation_access(value):
    if value in VALID_SESSION_CREATION_ACCESS:
        return value
    return SESSION_CREATION_ACCESS_STAFF


def _is_missing_session_creation_access_column_error(exc):
    message = ""
    if isinstance(exc, APIError):
        message = str(getattr(exc, "message", "") or exc.args[0] if exc.args else "")
        if not message and hasattr(exc, "json"):
            message = str(exc.json())
    else:
        message = str(exc)
    return "session_creation_access" in message and "schema cache" in message


def _can_user_create_session(profile, team, user_id):
    team_id = (profile or {}).get('team_id')
    if not team_id:
        return True

    session_creation_access = _normalize_session_creation_access((team or {}).get('session_creation_access'))
    role = (profile or {}).get('role')
    owner_id = str((team or {}).get('admin_id') or '')
    is_owner = owner_id == str(user_id)

    if session_creation_access == SESSION_CREATION_ACCESS_OWNER:
        return is_owner
    if session_creation_access == SESSION_CREATION_ACCESS_ALL:
        return True
    return is_owner or role in ('admin', 'coach')


def _get_profile_for_user(user_id):
    return _execute_query(
        lambda: supabase_admin.table('profiles').select('id, team_id, role').eq('id', str(user_id)),
        fallback=_FallbackResponse([]),
    ).data


def _get_team_for_profile(profile):
    team_id = (profile or {}).get('team_id')
    if not team_id:
        return None

    try:
        team_rows = _execute_query(
            lambda: supabase_admin.table('teams').select('id, admin_id, session_creation_access').eq('id', team_id),
            fallback=_FallbackResponse([]),
        ).data
    except Exception as exc:
        if _is_missing_session_creation_access_column_error(exc):
            team_rows = _execute_query(
                lambda: supabase_admin.table('teams').select('id, admin_id').eq('id', team_id),
                fallback=_FallbackResponse([]),
            ).data
        else:
            raise
    return team_rows[0] if team_rows else None


def _parse_timestamp(value):
    if not value:
        return None
    normalized = value.replace('Z', '+00:00')
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def is_qr_code_active(game):
    if game.get('ended_at') or not game.get('qr_code_url'):
        return False

    created_at = _parse_timestamp(game.get('created_at'))
    game_time = _parse_timestamp(game.get('game_time'))

    # Keep future sessions joinable even if they were created well in advance.
    if game_time and datetime.now(timezone.utc) < game_time:
        return True

    if not created_at:
        return True

    if game_time:
        expires_at = max(created_at, game_time) + QR_CODE_TTL
        return datetime.now(timezone.utc) <= expires_at

    return datetime.now(timezone.utc) <= created_at + QR_CODE_TTL


def has_session_started(game):
    game_time = _parse_timestamp(game.get('game_time'))
    if not game_time:
        return True
    return datetime.now(timezone.utc) >= game_time


def _resolve_qr_storage_path(game):
    qr_value = game.get('qr_code_url')
    if qr_value and not str(qr_value).startswith(('http://', 'https://')):
        return qr_value

    session_code = game.get('session_code')
    if session_code:
        return f"qr-codes/{session_code.upper()}.png"

    return None


def _sign_qr_url(game):
    storage_path = _resolve_qr_storage_path(game)
    if not storage_path:
        return None

    try:
        signed = supabase_admin.storage.from_(QR_STORAGE_BUCKET).create_signed_url(
            storage_path,
            expires_in=604800,
        )
        return signed.get("signedURL") or signed.get("signed_url")
    except Exception:
        return None


def serialize_game(game):
    serialized = dict(game)
    serialized['qr_code_storage_path'] = _resolve_qr_storage_path(game)
    serialized['qr_code_url'] = _sign_qr_url(game) if is_qr_code_active(game) else None
    serialized['qr_code_active'] = is_qr_code_active(game)
    serialized['manually_ended'] = bool(game.get('ended_at') or not game.get('qr_code_url'))
    serialized['session_started'] = has_session_started(game)
    serialized['can_accept_uploads'] = serialized['qr_code_active'] and serialized['session_started']
    return serialized


@api_view(['GET'])
def list_games(request):
    data = _execute_query(
        lambda: supabase_admin.table('games').select('*'),
        fallback=_FallbackResponse([]),
    )
    return Response([serialize_game(game) for game in data.data])

@api_view(['GET'])
def list_my_games(request):
    user = check_user(request.headers.get('Authorization'))
    user_id = str(user.id)
    profile = _execute_query(
        lambda: supabase_admin.table('profiles').select('team_id').eq('id', user_id),
        fallback=_FallbackResponse([]),
    )
    team_id = profile.data[0].get('team_id') if profile.data else None

    own_games = _execute_query(
        lambda: supabase_admin.table('games').select('*').eq('created_by', user_id),
        fallback=_FallbackResponse([]),
    ).data
    visible_games = {game['id']: game for game in own_games}

    if team_id:
        team_members = _execute_query(
            lambda: supabase_admin.table('profiles').select('id').eq('team_id', team_id),
            fallback=_FallbackResponse([]),
        ).data
        member_ids = [member['id'] for member in team_members]
        if member_ids:
            team_games = _execute_query(
                lambda: supabase_admin.table('games').select('*').in_('created_by', member_ids),
                fallback=_FallbackResponse([]),
            ).data
            for game in team_games:
                visible_games[game['id']] = game

    ordered_games = sorted(
        visible_games.values(),
        key=lambda game: game.get('game_time') or '',
        reverse=True,
    )

    return Response([
        {
            **serialize_game(game),
            'owned_by_current_user': game.get('created_by') == user_id,
        }
        for game in ordered_games
    ])

@api_view(['GET'])
def get_game(request, id): 
    data = _execute_query(
        lambda: supabase_admin.table('games').select('*').eq('id', id),
        fallback=_FallbackResponse([]),
    )
    return Response([serialize_game(game) for game in data.data])

@api_view(['POST'])
def create_game(request):
    user = check_user(request.headers.get('Authorization'))
    user_id = str(user.id)
    profile_rows = _get_profile_for_user(user_id)
    profile = profile_rows[0] if profile_rows else {}
    team = _get_team_for_profile(profile)

    if not _can_user_create_session(profile, team, user_id):
        policy = _normalize_session_creation_access((team or {}).get('session_creation_access'))
        policy_message = {
            SESSION_CREATION_ACCESS_OWNER: 'Only the team owner can create sessions for this team.',
            SESSION_CREATION_ACCESS_STAFF: 'Only the team owner, admins, and coaches can create sessions for this team.',
            SESSION_CREATION_ACCESS_ALL: 'All team members can create sessions for this team.',
        }
        return Response({'error': policy_message.get(policy, 'You are not allowed to create sessions for this team.')}, status=403)

    session_code = generate_session_code()
    while check_session_code_exists(session_code):
        session_code = generate_session_code()

    base_url = request.build_absolute_uri('/').rstrip('/').replace('/api', '')
    qr_code_url, _ = generate_qr_code(session_code, base_url)

    payload = {
        'title': request.data.get('title'),
        'game_time': request.data.get('game_time'),
        'created_by': str(user.id),
        'session_code': session_code,
        'qr_code_url': qr_code_url,
    }

    data = _execute_query(lambda: supabase_admin.table('games').insert(payload))
    return Response(serialize_game(data.data[0]), status=201)


@api_view(['PATCH'])
def update_game(request, id):
    user = check_user(request.headers.get('Authorization'))

    data = _execute_query(
        lambda: supabase_admin.table('games').select('*').eq('id', id),
        fallback=_FallbackResponse([]),
    )
    if not data.data:
        return Response({'error': 'Game not found'}, status=404)

    game = data.data[0]
    if game.get('created_by') != str(user.id):
        return Response({'error': 'Not authorized to update this session'}, status=403)
    if has_session_started(game):
        return Response({'error': 'You can only edit a session before it starts'}, status=400)

    next_game_time = request.data.get('game_time')
    if not next_game_time:
        return Response({'error': 'game_time is required'}, status=400)

    parsed_game_time = _parse_timestamp(next_game_time)
    if not parsed_game_time:
        return Response({'error': 'Invalid game_time'}, status=400)
    if parsed_game_time <= datetime.now(timezone.utc):
        return Response({'error': 'Session start time must be in the future'}, status=400)

    updated = (
        supabase_admin
        .table('games')
        .update({'game_time': next_game_time})
        .eq('id', id)
        .execute()
    )

    if updated.data:
        return Response(serialize_game(updated.data[0]))

    refreshed = _execute_query(
        lambda: supabase_admin.table('games').select('*').eq('id', id),
        fallback=_FallbackResponse([]),
    )
    return Response(serialize_game(refreshed.data[0]))

@api_view(['GET'])
def get_game_by_session_code(request, session_code):
    data = _execute_query(
        lambda: supabase_admin.table('games').select('*').eq('session_code', session_code.upper()),
        fallback=_FallbackResponse([]),
    )
    if len(data.data) == 0:
        return Response({'error': 'Invalid session code'}, status=404)
    if not is_qr_code_active(data.data[0]):
        return Response({'error': 'This session is no longer active'}, status=410)
    return Response(serialize_game(data.data[0]))


@api_view(['POST'])
def end_game_session(request, id):
    user = check_user(request.headers.get('Authorization'))

    data = _execute_query(
        lambda: supabase_admin.table('games').select('*').eq('id', id),
        fallback=_FallbackResponse([]),
    )
    if not data.data:
        return Response({'error': 'Game not found'}, status=404)

    game = data.data[0]
    if game.get('created_by') != str(user.id):
        return Response({'error': 'Not authorized to end this session'}, status=403)
    if not has_session_started(game):
        return Response({'error': 'You can only end a session after it has started'}, status=400)

    if not is_qr_code_active(game):
        return Response(serialize_game(game))

    update_payload = {'qr_code_url': None}
    ended_at = datetime.now(timezone.utc).isoformat()

    try:
        updated = (
            supabase_admin
            .table('games')
            .update({
                **update_payload,
                'ended_at': ended_at,
            })
            .eq('id', id)
            .execute()
        )
    except Exception:
        # Older Supabase schemas may not have ended_at yet; still allow the session to be ended.
        updated = (
            supabase_admin
            .table('games')
            .update(update_payload)
            .eq('id', id)
            .execute()
        )

    if updated.data:
        return Response(serialize_game(updated.data[0]))

    refreshed = _execute_query(
        lambda: supabase_admin.table('games').select('*').eq('id', id),
        fallback=_FallbackResponse([]),
    )
    return Response(serialize_game(refreshed.data[0]))


@api_view(['GET'])
def list_attachable_games(request):
    user = check_user(request.headers.get('Authorization'))
    profile = _execute_query(
        lambda: supabase_admin.table('profiles').select('team_id').eq('id', str(user.id)),
        fallback=_FallbackResponse([]),
    )
    team_id = profile.data[0].get('team_id') if profile.data else None

    own_games = _execute_query(
        lambda: supabase_admin.table('games').select('*').eq('created_by', str(user.id)),
        fallback=_FallbackResponse([]),
    ).data
    attachable_games = {game['id']: game for game in own_games}

    if team_id:
        team_members = _execute_query(
            lambda: supabase_admin.table('profiles').select('id').eq('team_id', team_id),
            fallback=_FallbackResponse([]),
        ).data
        member_ids = [member['id'] for member in team_members]
        if member_ids:
            team_games = _execute_query(
                lambda: supabase_admin.table('games').select('*').in_('created_by', member_ids),
                fallback=_FallbackResponse([]),
            ).data
            for game in team_games:
                attachable_games[game['id']] = game

    ordered_games = sorted(
        [serialize_game(game) for game in attachable_games.values() if is_qr_code_active(game) and has_session_started(game)],
        key=lambda game: game.get('game_time') or '',
        reverse=True,
    )
    return Response(ordered_games)

"""
TODO: 
- Permissions checking for game management? 
"""
