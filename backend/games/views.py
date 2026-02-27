from django.shortcuts import render
from utils.supabase_client import supabase, supabase_admin
from rest_framework.decorators import api_view
from rest_framework.response import Response
from utils.helpers import check_user
from utils.qr_generator import generate_session_code, generate_qr_code, check_session_code_exists

        
@api_view(['GET'])
def list_games(request):
    data = supabase_admin.table('games').select('*').execute()
    return Response(data.data)

@api_view(['GET'])
def get_game(request, id): 
    data = supabase_admin.table('games').select('*').eq('id', id).execute()
    return Response(data.data)

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
    return Response(data.data[0], status=201)

@api_view(['GET'])
def get_game_by_session_code(request, session_code):
    data = supabase.table('games').select('*').eq('session_code', session_code.upper()).execute()
    if len(data.data) == 0:
        return Response({'error': 'Invalid session code'}, status=404)
    return Response(data.data[0])

"""
TODO: 
- Permissions checking for game management? 
"""
