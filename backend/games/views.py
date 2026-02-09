from django.shortcuts import render
from utils.supabase_client import supabase
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['GET'])
def list_games(request):
    data = supabase.table('games').select('*').execute()
    return Response(data.data)

