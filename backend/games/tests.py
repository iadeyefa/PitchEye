from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from .views import is_qr_code_active, serialize_game


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
            "game_time": (now - timedelta(days=8)).isoformat(),
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
