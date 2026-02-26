from django.db import models

# Models are stored in Supabase

"""
Supabase Schema: video_clips

Fields:
- id: serial 
- game_id: int (FK to games)
- uploaded_by: uuid (FK to profiles)
- video_url: text (required)
- file_size: bigint (required)
- duration: float
- resolution: varchar(20)
- device_id: varchar(100) (required)
- device_name: varchar(100)
- recorded_at: timestamp (required)
- time_offset: float
- start_time: float
- end_time: float
- quality_score: int (1-100)
- camera_angle: enum (unknown default)
- is_processed: bool (false default)
- uploaded_at: timestamp (auto)
- updated_at: timestamp (auto)

Constraints:
- ON DELETE CASCADE for game_id
- quality_score must be 1-100
"""