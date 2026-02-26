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