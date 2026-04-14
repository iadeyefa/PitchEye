from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from .views import has_session_started, is_qr_code_active, serialize_game


class GameQrCodeTimingTests(SimpleTestCase):
    def test_future_session_created_more_than_ttl_ago_stays_active(self):
        now = datetime.now(timezone.utc)
        game = {
            "created_at": (now - timedelta(days=10)).isoformat(),
            "game_time": (now + timedelta(days=30)).isoformat(),
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
