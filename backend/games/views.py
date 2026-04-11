from datetime import datetime, timedelta, timezone
from django.shortcuts import render
from utils.supabase_client import supabase, supabase_admin
from rest_framework.decorators import api_view
from rest_framework.response import Response
from utils.helpers import check_user
from utils.qr_generator import generate_session_code, generate_qr_code, check_session_code_exists

QR_CODE_TTL = timedelta(days=7)
QR_STORAGE_BUCKET = 'qr-codes'


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

    signed = supabase_admin.storage.from_(QR_STORAGE_BUCKET).create_signed_url(
        storage_path,
        expires_in=604800,
    )
    return signed.get("signedURL") or signed.get("signed_url")


def serialize_game(game):
    serialized = dict(game)
    serialized['qr_code_storage_path'] = _resolve_qr_storage_path(game)
    serialized['qr_code_url'] = _sign_qr_url(game) if is_qr_code_active(game) else None
    serialized['qr_code_active'] = is_qr_code_active(game)
    serialized['session_started'] = has_session_started(game)
    serialized['can_accept_uploads'] = serialized['qr_code_active'] and serialized['session_started']
    return serialized


@api_view(['GET'])
def list_games(request):
    data = supabase_admin.table('games').select('*').execute()
    return Response([serialize_game(game) for game in data.data])

@api_view(['GET'])
def list_my_games(request):
    user = check_user(request.headers.get('Authorization'))
    data = supabase_admin.table('games').select('*').eq('created_by', str(user.id)).execute()
    return Response([serialize_game(game) for game in data.data])

@api_view(['GET'])
def get_game(request, id): 
    data = supabase_admin.table('games').select('*').eq('id', id).execute()
    return Response([serialize_game(game) for game in data.data])

@api_view(['POST'])
def create_game(request):
    user = check_user(request.headers.get('Authorization'))

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

    data = supabase_admin.table('games').insert(payload).execute()
    return Response(serialize_game(data.data[0]), status=201)

@api_view(['GET'])
def get_game_by_session_code(request, session_code):
    data = supabase_admin.table('games').select('*').eq('session_code', session_code.upper()).execute()
    if len(data.data) == 0:
        return Response({'error': 'Invalid session code'}, status=404)
    if not is_qr_code_active(data.data[0]):
        return Response({'error': 'This session QR code has expired'}, status=410)
    return Response(serialize_game(data.data[0]))


@api_view(['GET'])
def list_attachable_games(request):
    user = check_user(request.headers.get('Authorization'))
    profile = supabase_admin.table('profiles').select('team_id').eq('id', str(user.id)).execute()
    team_id = profile.data[0].get('team_id') if profile.data else None

    own_games = supabase_admin.table('games').select('*').eq('created_by', str(user.id)).execute().data
    attachable_games = {game['id']: game for game in own_games}

    if team_id:
        team_members = supabase_admin.table('profiles').select('id').eq('team_id', team_id).execute().data
        member_ids = [member['id'] for member in team_members]
        if member_ids:
            team_games = supabase_admin.table('games').select('*').in_('created_by', member_ids).execute().data
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
