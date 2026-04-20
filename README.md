# PitchEye

PitchEye is a soccer-focused team platform for clubs, coaches, players, and families to organize match footage, capture live moments from the sidelines, and keep team video in one shared place. It is designed around the way soccer teams actually record and share games: multiple phones, multiple angles, and one team space for sessions, clips, and live activity.

## Soccer Team Workflow

- Creates team spaces where clubs and teammates can organize sessions and footage
- Lets volunteers join a match or practice session with a QR code and record from the sideline
- Brings clips from multiple devices into a shared team feed for players, coaches, and families
- Supports soccer-specific review and sharing workflows around matches, teammates, and key moments
- Builds toward a multi-angle viewing experience for full-match review and highlight access

## Repository Layout

- `backend/` Django API, Supabase-backed business logic, and processing services
- `frontend/` React web app for teams, sessions, uploads, and profile management
- `mobile/` React Native mobile client for scanning and live capture workflows

## Tech Stack

- Backend: Python, Django, Django REST Framework
- Frontend: React, TypeScript
- Mobile: React Native
- Database: Supabase (PostgreSQL)
- Storage: Supabase Storage
- Video Processing: FFmpeg, OpenCV
- Streaming: WebRTC, RTMP
- Containerization: Docker

## Current Product Areas

- Authentication and profile management
- Team creation and team membership
- Team-managed session creation permissions
- Session scheduling, QR access, and live session pages
- Clip upload, viewing, and team feed workflows

## Getting Started

The project currently runs as three separate local apps:

- `backend/` for the Django API
- `frontend/` for the React web app
- `mobile/` for the Expo mobile app

## Local Setup

### Prerequisites

- Python 3
- Node.js and npm
- A Supabase project with the required tables, auth, and storage buckets
- Expo CLI tooling if you want to run the mobile app

### 1. Configure Supabase

The app expects Supabase for:

- authentication
- PostgreSQL data
- storage for QR codes and video assets

Recommended setup:

```text
Run /supabase_schema.sql in the Supabase SQL editor.
```

That bootstrap file creates the core tables, auth profile trigger, and storage buckets currently expected by the app.

Important included schema details:

- `teams.session_creation_access` as `text not null default 'staff_only'`
- storage buckets for `match-videos` and `qr-codes`

### 2. Start the Backend

Create a `backend/.env` file with:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
SUPABASE_VIDEO_BUCKET=match-videos
```

Then install and run:

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py runserver
```

The backend runs on:

```text
http://localhost:8000
```

### 3. Start the Frontend

Create `frontend/.env.local` with:

```env
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
REACT_APP_SRS_API=your_stream_api_url
REACT_APP_SRS_HTTP=your_stream_http_url
```

Then install and run:

```bash
cd frontend
npm install
npm start
```

Important note:

- the frontend currently calls the API at `http://localhost:8000/api`

### 4. Start the Mobile App

If you want to run the Expo mobile client:

```bash
cd mobile
npm install
npm start
```

From there, you can launch the app in Expo, on a simulator, or on a connected device.

### 5. Verify the App

Once everything is running:

- create or log into a Supabase-backed account
- create or join a team
- create a session from an allowed account
- open the upload flow and attach a clip to a session

If something fails early, check:

- backend env vars
- frontend env vars
- Supabase auth configuration
- required database columns
- required storage buckets

## Status

PitchEye is actively being built. Some setup instructions and operational details are still being documented as the product evolves.
