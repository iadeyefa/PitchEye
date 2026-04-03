import os
from pathlib import Path

from supabase import create_client
from dotenv import load_dotenv

# Always load the backend-local .env file, even if Django is started from the repo root
# or the shell already has stale SUPABASE_* variables exported.
BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env", override=True)

# For auth verification
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

# For backend operations like storage (service role key, bypasses RLS)
supabase_admin = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)
