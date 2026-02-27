from django.db import models

# Models are stored in Supabase
"""
Supabase Schema: games

Fields:
- id: serial (auto-increment primary key)
- session_code: varchar(10) (unique)
- qr_code_url: text
- title: text
- game_time: timestamp
- created_by: uuid (FK to profiles)
- is_synchronized: bool (default false)
- is_processed: bool (default false)
- created_at: timestamp (auto, default now())

Constraints:
- Unique constraint on session_code
- FK to profiles(id)
"""