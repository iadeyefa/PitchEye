from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from .views import get_user


class GetUserTests(SimpleTestCase):
    @patch("users.views.check_user")
    @patch("users.views.supabase_admin")
    def test_get_user_returns_profile_data(self, mock_supabase_admin, mock_check_user):
        mock_check_user.return_value = SimpleNamespace(id="user-1")
        mock_supabase_admin.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[{"id": "user-1", "email": "ife@example.com"}])
        )

        request = APIRequestFactory().get("/api/users/get_user/", HTTP_AUTHORIZATION="Bearer token")
        response = get_user(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]["id"], "user-1")

    @patch("users.views.time.sleep", return_value=None)
    @patch("users.views.check_user")
    @patch("users.views.supabase_admin")
    def test_get_user_returns_503_after_retries_are_exhausted(self, mock_supabase_admin, mock_check_user, _mock_sleep):
        mock_check_user.return_value = SimpleNamespace(id="user-1")
        mock_supabase_admin.table.return_value.select.return_value.eq.return_value.execute.side_effect = RuntimeError("boom")

        request = APIRequestFactory().get("/api/users/get_user/", HTTP_AUTHORIZATION="Bearer token")
        response = get_user(request)

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"], "Unable to load your profile right now. Please try again.")
