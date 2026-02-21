from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

resp = supabase.auth.sign_in_with_password({
    "email": "adeyefaife@gmail.com",
    "password": "#CanineDuke24"
})

print(resp.session.access_token)