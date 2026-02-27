from utils.supabase_client import supabase
from rest_framework.exceptions import AuthenticationFailed

def _extract_bearer_token(auth_header):
    if not auth_header:
        raise AuthenticationFailed('Missing Authorization header')

    if not isinstance(auth_header, str):
        raise AuthenticationFailed('Invalid Authorization header format')

    parts = auth_header.strip().split(' ', 1)
    if len(parts) != 2 or parts[0] != 'Bearer' or not parts[1].strip():
        raise AuthenticationFailed('Authorization header must be: Bearer <access_token>')

    return parts[1].strip()

def check_user(auth_header):
    token = _extract_bearer_token(auth_header)

    try:
        auth_response = supabase.auth.get_user(token)
        user = getattr(auth_response, 'user', None)
        if not user:
            raise AuthenticationFailed('Invalid access token')
        return user
    except AuthenticationFailed:
        raise
    except Exception as exc:
        raise AuthenticationFailed('Invalid or expired access token') from exc
