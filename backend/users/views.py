from django.shortcuts import render
from utils.supabase_client import supabase
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['GET'])
def list_users(request):
    data = supabase.table('profiles').select('*').execute()
    return Response(data.data)

@api_view(['GET'])
def get_user(request, user_id): 
    data = supabase.table('profiles').select('*').eq('id', user_id).execute()
    return Response(data.data)

@api_view(['POST'])
def create_user(request):
    u_id = request.data.get('userId')
    f_name = request.data.get('firstName')
    l_name = request.data.get('lastName')
    email = request.data.get('email')
    role = request.data.get('role')
    team_id = request.data.get('team_id')

    data = supabase.table('profiles').insert({'id': u_id, 'email': email, 'role': role, 'team_id': team_id}).execute()
    return Response(data.data)

"""
TODO: 
- Change profile information
- Delete user
"""