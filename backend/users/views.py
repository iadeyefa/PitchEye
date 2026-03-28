from django.shortcuts import render
from utils.supabase_client import supabase, supabase_admin
from rest_framework.decorators import api_view
from rest_framework.response import Response
from utils.helpers import check_user


@api_view(['GET'])
def list_users(request):
    data = supabase.table('profiles').select('*').execute()
    return Response(data.data)

@api_view(['GET'])
def get_user(request):
    user = check_user(request.headers.get('Authorization'))
    data = supabase_admin.table('profiles').select('*').eq('id', str(user.id)).execute()
    return Response(data.data)

@api_view(['POST'])
def create_user(request):
    u_id = request.data.get('userId')
    f_name = request.data.get('firstName')
    l_name = request.data.get('lastName')
    email = request.data.get('email')
    role = request.data.get('role')
    team_id = request.data.get('team_id')
    username = ' '.join(part for part in [f_name, l_name] if part).strip() or email.split('@')[0]

    data = supabase_admin.table('profiles').insert({
        'id': u_id,
        'email': email,
        'role': role,
        'team_id': team_id,
        'username': username,
    }).execute()
    return Response(data.data)


@api_view(['PATCH'])
def update_user(request):
    user = check_user(request.headers.get('Authorization'))
    username = (request.data.get('username') or '').strip()

    if not username:
        return Response({'error': 'Name is required'}, status=400)

    data = supabase_admin.table('profiles').update({'username': username}).eq('id', str(user.id)).execute()
    return Response(data.data[0] if data.data else {'username': username})

"""
TODO: 
- Change profile information
- Delete user
"""
