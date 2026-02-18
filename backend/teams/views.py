import random
import string
from django.shortcuts import render
from utils.supabase_client import supabase
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['GET'])
def list_teams(request):
    data = supabase.table('teams').select('*').execute()
    return Response(data.data)

@api_view(['GET'])
def get_team(request):
    team_code = request.query_params.get('code')
    data = supabase.table('teams').select('*').eq('join_code', team_code).execute()
    return Response(data.data)

@api_view(['POST'])
def create_team(request): 
    team_name = request.data.get('teamName')
    admin_id = request.data.get('adminID')

    # generate some random code for team_code in teams
    join_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    # create team in teams table
    data = supabase.table('teams').insert({'name': team_name,'join_code': join_code ,'admin_id': admin_id}).execute()

    # update team_id var in the admin_id with the new team_id
    new_team_id = data.data[0]['id']
    supabase.table('profiles').update({'team_id': new_team_id}).eq('id', admin_id).execute()
    
    return Response(data.data)
