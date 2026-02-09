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

"""
TODO: 
- Change profile information
- Delete user
"""