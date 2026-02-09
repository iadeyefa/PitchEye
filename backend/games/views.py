from django.shortcuts import render
from utils.supabase_client import supabase
from rest_framework.decorators import api_view
from rest_framework.response import Response
from utils.helpers import check_user
        
@api_view(['GET'])
def list_games(request):
    data = supabase.table('games').select('*').execute()
    return Response(data.data)

@api_view(['GET'])
def get_game(request, id): 
    data = supabase.table('games').select('*').eq('id', id).execute()
    return Response(data.data)

@api_view(['POST'])
def create_game(request): 
    try:
        user = check_user(request.headers.get('Authorization'))
    except Exception as e:
        return Response({'error': str(e)}, status=401)
    
    payload = {
        'title': request.data.get('title'),
        'game_time': request.data.get('game_time'),
        'created_by': user.id,  
        'session_code': 123, # TODO: Placeholder
    }
    
    data = supabase.table('games').insert(payload).execute()
    return Response(data.data, status=201)

"""
TODO: 
- Generate session code
- Permissions checking for game management? 
"""