from utils.supabase_client import supabase

def check_user(auth_header):
    if not auth_header:
        raise Exception('no auth token')
    
    token = auth_header.replace('Bearer ', '')

    try:
        user = supabase.auth.get_user(token)
        return user.user
    except Exception as e:
        raise Exception(e,  ' invalid token')
        