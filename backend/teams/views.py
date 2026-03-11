import random
import string
from django.shortcuts import render
from utils.supabase_client import supabase, supabase_admin
from rest_framework.decorators import api_view
from rest_framework.response import Response
from utils.helpers import check_user

@api_view(['GET'])
def list_teams(request):
    data = supabase.table('teams').select('*').execute()
    return Response(data.data)

@api_view(['GET'])
def get_team(request):
    team_code = request.query_params.get('code')
    data = supabase_admin.table('teams').select('*').eq('join_code', team_code).execute()
    return Response(data.data)

@api_view(['POST'])
def create_team(request):
    user = check_user(request.headers.get('Authorization'))

    # check if user already on a team
    profile = supabase_admin.table('profiles').select('team_id, role').eq('id', str(user.id)).execute()
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
    data = supabase_admin.table('teams').insert({
        'name': team_name,
        'join_code': join_code,
        'admin_id': str(user.id)
    }).execute()

    team_id = data.data[0]['id']
    supabase_admin.table('profiles').update({'team_id': team_id}).eq('id', str(user.id)).execute()

    return Response(data.data[0], status=201)


@api_view(['POST'])
def leave_team(request):
    user = check_user(request.headers.get('Authorization'))
    supabase_admin.table('profiles').update({'team_id': None}).eq('id', str(user.id)).execute()
    return Response({'message': 'Left team successfully'})

@api_view(['POST'])
def join_team(request):
    user = check_user(request.headers.get('Authorization'))
    join_code = request.data.get('join_code', '').upper()

    team = supabase.table('teams').select('*').eq('join_code', join_code).execute()
    if not team.data:
        return Response({'error': 'Invalid team code'}, status=404)

    team_id = team.data[0]['id']
    supabase_admin.table('profiles').update({'team_id': team_id}).eq('id', str(user.id)).execute()

    return Response(team.data[0])

@api_view(['GET'])
def get_my_team(request):
    user = check_user(request.headers.get('Authorization'))

    profile = supabase_admin.table('profiles').select('team_id').eq('id', str(user.id)).execute()
    if not profile.data or not profile.data[0].get('team_id'):
        return Response({'error': 'No team found'}, status=404)

    team_id = profile.data[0]['team_id']

    team = supabase_admin.table('teams').select('*').eq('id', team_id).execute()
    members = supabase_admin.table('profiles').select('id, email, role').eq('team_id', team_id).execute()
    member_ids = [m['id'] for m in members.data]

    games = supabase_admin.table('games').select('*').in_('created_by', member_ids).execute()

    return Response({
        'team': team.data[0],
        'members': members.data,
        'games': games.data,
    })