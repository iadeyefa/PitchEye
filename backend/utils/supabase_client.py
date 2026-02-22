from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

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