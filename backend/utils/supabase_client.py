import os
from pathlib import Path

from supabase import create_client
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env", override=True)

supabase_url = os.getenv("SUPABASE_URL") or os.getenv("REACT_APP_SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY") or os.getenv("REACT_APP_SUPABASE_ANON_KEY")
supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("REACT_APP_SUPABASE_SERVICE_KEY")

supabase = create_client(supabase_url, supabase_key)
supabase_admin = create_client(supabase_url, supabase_service_key)