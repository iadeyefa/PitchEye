from django.db import models

# Models are stored in Supabase
"""
Supabase Schema: profiles

Fields:
- id: uuid (primary key, FK to auth.users)
- email: text
- username: text
- role: enum (user_role) - default 'viewer'
  Options: viewer, coach, admin (or whatever your enum values are)
- created_at: timestamp (auto, default now())

Constraints:
- FK to auth.users(id) with ON DELETE CASCADE
- Auto-syncs with supabase auth table
"""