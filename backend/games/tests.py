from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from .views import has_session_started, is_qr_code_active, list_my_games, serialize_game
from .views import (
    SESSION_CREATION_ACCESS_ALL,
    SESSION_CREATION_ACCESS_OWNER,
    SESSION_CREATION_ACCESS_STAFF,
    _can_user_create_session,
)


class GameQrCodeTimingTests(SimpleTestCase):
    def test_future_session_created_more_than_ttl_ago_stays_active(self):
        now = datetime.now(timezone.utc)
        game = {
            "created_at": (now - timedelta(days=10)).isoformat(),
            "game_time": (now + timedelta(days=30)).isoformat(),
            "qr_code_url": "qr-codes/FUTURE1.png",
        }

        self.assertTrue(is_qr_code_active(game))

    def test_past_session_expires_ttl_after_game_time(self):
        now = datetime.now(timezone.utc)
        game = {
            "created_at": (now - timedelta(days=40)).isoformat(),
            "game_time": (now - timedelta(days=2)).isoformat(),
        }

        self.assertFalse(is_qr_code_active(game))

    def test_session_expires_one_day_after_game_time(self):
        now = datetime.now(timezone.utc)
        game = {
            "created_at": (now - timedelta(days=3)).isoformat(),
            "game_time": (now - timedelta(hours=20)).isoformat(),
            "qr_code_url": "qr-codes/ACTIVE.png",
        }

        self.assertTrue(is_qr_code_active(game))

    def test_manually_ended_session_is_inactive(self):
        now = datetime.now(timezone.utc)
        game = {
            "created_at": (now - timedelta(hours=1)).isoformat(),
            "game_time": (now - timedelta(minutes=30)).isoformat(),
            "qr_code_url": None,
            "ended_at": now.isoformat(),
        }

        self.assertFalse(is_qr_code_active(game))

    @patch("games.views.supabase_admin")
    def test_future_session_gets_fresh_signed_qr_url(self, mock_supabase_admin):
        now = datetime.now(timezone.utc)
        storage_bucket = MagicMock()
        storage_bucket.create_signed_url.return_value = {"signedURL": "https://example.com/fresh-qr"}
        mock_supabase_admin.storage.from_.return_value = storage_bucket

        game = {
            "session_code": "VPRW9X",
            "created_at": (now - timedelta(days=30)).isoformat(),
            "game_time": (now + timedelta(days=30)).isoformat(),
            "qr_code_url": "https://old-expired-link.example.com/qr.png",
        }

        serialized = serialize_game(game)

        self.assertTrue(serialized["qr_code_active"])
        self.assertEqual(serialized["qr_code_storage_path"], "qr-codes/VPRW9X.png")
        self.assertEqual(serialized["qr_code_url"], "https://example.com/fresh-qr")

    def test_serialize_game_marks_manually_ended_sessions(self):
        now = datetime.now(timezone.utc)
        game = {
            "session_code": "VPRW9X",
            "created_at": (now - timedelta(days=1)).isoformat(),
            "game_time": (now - timedelta(hours=1)).isoformat(),
            "qr_code_url": None,
            "ended_at": now.isoformat(),
        }

        serialized = serialize_game(game)

        self.assertFalse(serialized["qr_code_active"])
        self.assertTrue(serialized["manually_ended"])

    def test_has_session_started_false_for_future_session(self):
        now = datetime.now(timezone.utc)
        game = {
            "game_time": (now + timedelta(hours=2)).isoformat(),
        }

        self.assertFalse(has_session_started(game))


class ListMyGamesTests(SimpleTestCase):
    @patch("games.views.check_user")
    @patch("games.views.supabase_admin")
    def test_list_my_games_includes_team_sessions_and_marks_ownership(self, mock_supabase_admin, mock_check_user):
        user_id = "user-1"
        teammate_id = "user-2"
        mock_check_user.return_value = SimpleNamespace(id=user_id)

        own_game = {
            "id": 1,
            "title": "Own Session",
            "created_by": user_id,
            "session_code": "OWN123",
            "game_time": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
            "qr_code_url": "qr-codes/OWN123.png",
        }
        team_game = {
            "id": 2,
            "title": "Team Session",
            "created_by": teammate_id,
            "session_code": "TEAM12",
            "game_time": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
            "qr_code_url": "qr-codes/TEAM12.png",
        }

        mock_supabase_admin.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            SimpleNamespace(data=[{"team_id": 99}]),
            SimpleNamespace(data=[own_game]),
            SimpleNamespace(data=[{"id": user_id}, {"id": teammate_id}]),
        ]
        mock_supabase_admin.table.return_value.select.return_value.in_.return_value.execute.return_value = SimpleNamespace(
            data=[own_game, team_game]
        )

        request = APIRequestFactory().get("/api/games/my/", HTTP_AUTHORIZATION="Bearer token")
        response = list_my_games(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(response.data[0]["id"], 1)
        self.assertTrue(response.data[0]["owned_by_current_user"])
        self.assertEqual(response.data[1]["id"], 2)
        self.assertFalse(response.data[1]["owned_by_current_user"])


class SessionCreationPolicyTests(SimpleTestCase):
    def test_owner_only_policy_allows_only_owner(self):
        profile = {"team_id": 7, "role": "coach"}
        team = {"admin_id": "owner-1", "session_creation_access": SESSION_CREATION_ACCESS_OWNER}

        self.assertTrue(_can_user_create_session(profile, team, "owner-1"))
        self.assertFalse(_can_user_create_session(profile, team, "coach-2"))

    def test_staff_only_policy_allows_admins_and_coaches(self):
        admin_profile = {"team_id": 7, "role": "admin"}
        coach_profile = {"team_id": 7, "role": "coach"}
        player_profile = {"team_id": 7, "role": "player"}
        team = {"admin_id": "owner-1", "session_creation_access": SESSION_CREATION_ACCESS_STAFF}

        self.assertTrue(_can_user_create_session(admin_profile, team, "admin-2"))
        self.assertTrue(_can_user_create_session(coach_profile, team, "coach-2"))
        self.assertFalse(_can_user_create_session(player_profile, team, "player-2"))

    def test_all_members_policy_allows_any_team_member(self):
        player_profile = {"team_id": 7, "role": "player"}
        team = {"admin_id": "owner-1", "session_creation_access": SESSION_CREATION_ACCESS_ALL}

        self.assertTrue(_can_user_create_session(player_profile, team, "player-2"))
