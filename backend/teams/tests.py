from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import resolve
from rest_framework.test import APIRequestFactory

from teams import views


class TeamUrlTests(SimpleTestCase):
    def test_join_endpoint_resolves(self):
        match = resolve("/api/teams/join/")
        self.assertEqual(match.func, views.join_team)

    def test_my_team_endpoint_resolves(self):
        match = resolve("/api/teams/my/")
        self.assertEqual(match.func, views.get_my_team)


class JoinTeamTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    @patch("teams.views._execute_query")
    @patch("teams.views.check_user")
    @patch("teams.views.supabase_admin")
    def test_join_team_uses_admin_client_and_normalizes_code(
        self,
        mock_supabase_admin,
        mock_check_user,
        mock_execute_query,
    ):
        mock_check_user.return_value = SimpleNamespace(id="user-123")
        mock_execute_query.side_effect = [
            SimpleNamespace(data=[{"id": 7, "join_code": "PAPOTK"}]),
            SimpleNamespace(data=[]),
        ]

        request = self.factory.post(
            "/api/teams/join/",
            {"join_code": " papotk "},
            format="json",
            HTTP_AUTHORIZATION="Bearer token",
        )

        response = views.join_team(request)

        self.assertEqual(response.status_code, 200)
        first_query_factory = mock_execute_query.call_args_list[0].args[0]
        first_query_factory()
        mock_supabase_admin.table.assert_any_call("teams")
        mock_supabase_admin.table.return_value.select.return_value.eq.assert_called_with(
            "join_code",
            "PAPOTK",
        )
