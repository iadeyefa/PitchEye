import random
import string
import time
from postgrest.exceptions import APIError
from django.shortcuts import render
from utils.supabase_client import supabase, supabase_admin
from rest_framework.decorators import api_view
from rest_framework.response import Response
from utils.helpers import check_user

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


def _serialize_team(team):
    return {
        **team,
        'session_creation_access': _normalize_session_creation_access(team.get('session_creation_access')),
    }


def _fetch_team_rows(query_factory):
    try:
        return _execute_query(query_factory, fallback=_FallbackResponse([])).data
    except Exception as exc:
        if _is_missing_session_creation_access_column_error(exc):
            return _execute_query(
                lambda: supabase_admin.table('teams').select('id, name, join_code, admin_id, created_at, updated_at'),
                fallback=_FallbackResponse([]),
            ).data
        raise


def _get_team_by_id(team_id, client=None):
    db = client or supabase_admin
    try:
        return _execute_query(
            lambda: db.table('teams').select('*').eq('id', team_id),
            fallback=_FallbackResponse([]),
        ).data
    except Exception as exc:
        if _is_missing_session_creation_access_column_error(exc):
            return _execute_query(
                lambda: db.table('teams').select('id, name, join_code, admin_id, created_at, updated_at').eq('id', team_id),
                fallback=_FallbackResponse([]),
            ).data
        raise

@api_view(['GET'])
def list_teams(request):
    try:
        data = _execute_query(lambda: supabase.table('teams').select('*'), fallback=_FallbackResponse([]))
    except Exception as exc:
        if _is_missing_session_creation_access_column_error(exc):
            data = _execute_query(
                lambda: supabase.table('teams').select('id, name, join_code, admin_id, created_at, updated_at'),
                fallback=_FallbackResponse([]),
            )
        else:
            raise
    return Response([_serialize_team(team) for team in data.data])

@api_view(['GET'])
def get_team(request):
    team_code = request.query_params.get('code')
    try:
        data = _execute_query(
            lambda: supabase_admin.table('teams').select('*').eq('join_code', team_code),
            fallback=_FallbackResponse([]),
        )
    except Exception as exc:
        if _is_missing_session_creation_access_column_error(exc):
            data = _execute_query(
                lambda: supabase_admin.table('teams').select('id, name, join_code, admin_id, created_at, updated_at').eq('join_code', team_code),
                fallback=_FallbackResponse([]),
            )
        else:
            raise
    return Response([_serialize_team(team) for team in data.data])

@api_view(['POST'])
def create_team(request):
    user = check_user(request.headers.get('Authorization'))

    # check if user already on a team
    profile = _execute_query(
        lambda: supabase_admin.table('profiles').select('team_id, role').eq('id', str(user.id)),
        fallback=_FallbackResponse([]),
    )
    if not profile.data:
        return Response({'error': 'Profile not found'}, status=404)

    user_profile = profile.data[0]
    if user_profile.get('team_id'):
        return Response({'error': 'You are already on a team. Please leave first.'}, status=400)

    if user_profile.get('role') not in ['admin', 'coach']:
        return Response({'error': 'Only admins and coaches can create teams.'}, status=403)

    team_name = request.data.get('team_name', '').strip()
    if not team_name:
        return Response({'error': 'Team name is required'}, status=400)

    join_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    try:
        data = _execute_query(lambda: supabase_admin.table('teams').insert({
            'name': team_name,
            'join_code': join_code,
            'admin_id': str(user.id),
            'session_creation_access': SESSION_CREATION_ACCESS_STAFF,
        }))
    except Exception as exc:
        if _is_missing_session_creation_access_column_error(exc):
            data = _execute_query(lambda: supabase_admin.table('teams').insert({
                'name': team_name,
                'join_code': join_code,
                'admin_id': str(user.id),
            }))
        else:
            raise

    team_id = data.data[0]['id']
    _execute_query(lambda: supabase_admin.table('profiles').update({'team_id': team_id}).eq('id', str(user.id)))

    return Response(_serialize_team(data.data[0]), status=201)


@api_view(['POST'])
def leave_team(request):
    user = check_user(request.headers.get('Authorization'))
    _execute_query(lambda: supabase_admin.table('profiles').update({'team_id': None}).eq('id', str(user.id)))
    return Response({'message': 'Left team successfully'})

@api_view(['POST'])
def join_team(request):
    user = check_user(request.headers.get('Authorization'))
    join_code = request.data.get('join_code', '').strip().upper()

    team = _execute_query(
        lambda: supabase_admin.table('teams').select('*').eq('join_code', join_code),
        fallback=_FallbackResponse([]),
    )
    if not team.data:
        return Response({'error': 'Invalid team code'}, status=404)

    team_id = team.data[0]['id']
    _execute_query(lambda: supabase_admin.table('profiles').update({'team_id': team_id}).eq('id', str(user.id)))

    return Response(_serialize_team(team.data[0]))

@api_view(['GET'])
def get_my_team(request):
    from supabase import create_client
    import os

    client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
    user = check_user(request.headers.get('Authorization'))

    profile = _execute_query(
        lambda: supabase_admin.table('profiles').select('team_id').eq('id', str(user.id)),
        fallback=_FallbackResponse([]),
    )
    if not profile.data or not profile.data[0].get('team_id'):
        return Response({'error': 'No team found'}, status=404)

    team_id = profile.data[0]['team_id']

    team = _FallbackResponse(_get_team_by_id(team_id, client))
    members = _execute_query(
        lambda: client.table('profiles').select('id, email, role, username').eq('team_id', team_id),
        fallback=_FallbackResponse([]),
    )
    member_ids = [m['id'] for m in members.data]

    if not member_ids:
        games = []
    else:
        games = _execute_query(
            lambda: client.table('games').select('*').in_('created_by', member_ids),
            fallback=_FallbackResponse([]),
        )

    return Response({
        'team': _serialize_team(team.data[0]),
        'members': members.data,
        'games': games.data,
    })

@api_view(['GET'])
def get_team_by_id(request, id):
    from supabase import create_client
    import os

    client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
    check_user(request.headers.get('Authorization'))

    team = _FallbackResponse(_get_team_by_id(id, client))
    if not team.data:
        return Response({'error': 'Team not found'}, status=404)

    members = _execute_query(
        lambda: client.table('profiles').select('id, email, role, username').eq('team_id', id),
        fallback=_FallbackResponse([]),
    )
    member_ids = [m['id'] for m in members.data]

    if not member_ids:
        games_data = []
    else:
        games_data = _execute_query(
            lambda: client.table('games').select('*').in_('created_by', member_ids),
            fallback=_FallbackResponse([]),
        ).data

    return Response({
        'team': _serialize_team(team.data[0]),
        'members': members.data,
        'games': games_data,
    })


@api_view(['PATCH'])
def update_team(request, id):
    user = check_user(request.headers.get('Authorization'))
    team_name = (request.data.get('team_name') or '').strip()
    session_creation_access = request.data.get('session_creation_access')

    if not team_name and session_creation_access is None:
        return Response({'error': 'At least one team setting is required'}, status=400)
    if session_creation_access is not None and session_creation_access not in VALID_SESSION_CREATION_ACCESS:
        return Response({'error': 'Invalid session creation setting'}, status=400)

    profile = _execute_query(
        lambda: supabase_admin.table('profiles').select('team_id, role').eq('id', str(user.id)),
        fallback=_FallbackResponse([]),
    )
    if not profile.data:
        return Response({'error': 'Profile not found'}, status=404)

    user_profile = profile.data[0]
    if int(user_profile.get('team_id') or 0) != int(id):
        return Response({'error': 'You can only edit your own team'}, status=403)

    if team_name and user_profile.get('role') not in ['admin', 'coach']:
        return Response({'error': 'Only admins and coaches can edit the team name.'}, status=403)

    existing_team = _FallbackResponse(_get_team_by_id(id))
    if not existing_team.data:
        return Response({'error': 'Team not found'}, status=404)

    team = existing_team.data[0]
    update_payload = {}

    if team_name:
        update_payload['name'] = team_name

    if session_creation_access is not None:
        if str(team.get('admin_id') or '') != str(user.id):
            return Response({'error': 'Only the team owner can change session creation permissions.'}, status=403)
        update_payload['session_creation_access'] = session_creation_access

    try:
        data = _execute_query(lambda: supabase_admin.table('teams').update(update_payload).eq('id', id))
    except Exception as exc:
        if session_creation_access is not None and _is_missing_session_creation_access_column_error(exc):
            return Response(
                {'error': 'Session creation permissions are not available yet because the database has not been updated.'},
                status=409,
            )
        raise
    if not data.data:
        return Response({'error': 'Team not found'}, status=404)

    return Response(_serialize_team(data.data[0]))
