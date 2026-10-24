import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from backend.prodpilot.api.server import app
from backend.prodpilot.db import create_project, get_project, list_projects

client = TestClient(app)


@pytest.fixture
def sample_project():
    # Ensure a test project exists
    projects = list_projects()
    for p in projects:
        if p["github_repo"] == "testowner/testrepo":
            return p
    proj = create_project(
        name="Test Issues Project",
        github_repo="testowner/testrepo",
        github_token="ghp_testtoken123",
        local_path="/tmp/test_issues_repo",
        default_branch="main",
        test_cmd="pytest",
        set_active=True,
    )
    return proj


def test_get_project_issues_list(sample_project):
    mock_issues = [
        {
            "id": "1001",
            "number": 1,
            "title": "Database connection pool timeout",
            "body": "Connection refused on port 5432 after 30s",
            "state": "OPEN",
            "state_reason": None,
            "author": "devuser",
            "author_avatar": "https://avatars.githubusercontent.com/u/123",
            "labels": [{"id": 1, "name": "bug", "color": "d73a4a", "description": ""}],
            "assignees": ["devuser"],
            "comments_count": 2,
            "created_at": "2026-10-24T00:00:00Z",
            "updated_at": "2026-10-24T01:00:00Z",
            "closed_at": None,
            "html_url": "https://github.com/testowner/testrepo/issues/1",
        }
    ]

    with patch("backend.prodpilot.integrations.github_client.GitHubClient.get_issues") as mock_get:
        mock_get.return_value = {"ok": True, "issues": mock_issues, "count": 1}

        res = client.get(f"/projects/{sample_project['id']}/issues?state=open")
        assert res.status_code == 200
        data = res.json()
        assert data["ok"] is True
        assert len(data["issues"]) == 1
        assert data["issues"][0]["title"] == "Database connection pool timeout"
        assert data["issues"][0]["labels"][0]["name"] == "bug"


def test_get_project_single_issue(sample_project):
    mock_issue = {
        "id": "1001",
        "number": 1,
        "title": "Database connection pool timeout",
        "body": "Connection refused on port 5432 after 30s",
        "state": "OPEN",
        "state_reason": None,
        "author": "devuser",
        "author_avatar": "https://avatars.githubusercontent.com/u/123",
        "labels": [{"id": 1, "name": "bug", "color": "d73a4a", "description": ""}],
        "assignees": ["devuser"],
        "comments_count": 2,
        "created_at": "2026-10-24T00:00:00Z",
        "updated_at": "2026-10-24T01:00:00Z",
        "closed_at": None,
        "html_url": "https://github.com/testowner/testrepo/issues/1",
    }

    with patch("backend.prodpilot.integrations.github_client.GitHubClient.get_issue") as mock_get_single:
        mock_get_single.return_value = {"ok": True, "issue": mock_issue}

        res = client.get(f"/projects/{sample_project['id']}/issues/1")
        assert res.status_code == 200
        data = res.json()
        assert data["ok"] is True
        assert data["issue"]["number"] == 1
        assert data["issue"]["title"] == "Database connection pool timeout"


def test_create_project_issue(sample_project):
    mock_created = {
        "ok": True,
        "issue_number": 42,
        "issue_url": "https://github.com/testowner/testrepo/issues/42",
        "issue": {
            "id": "1042",
            "number": 42,
            "title": "Frontend UI glitch on Safari",
            "body": "Modal does not center properly",
            "state": "OPEN",
            "state_reason": None,
            "author": "tester",
            "author_avatar": "",
            "labels": [{"id": 2, "name": "ui", "color": "ededed", "description": ""}],
            "assignees": [],
            "comments_count": 0,
            "created_at": "2026-10-24T05:00:00Z",
            "updated_at": "2026-10-24T05:00:00Z",
            "closed_at": None,
            "html_url": "https://github.com/testowner/testrepo/issues/42",
        },
    }

    with patch("backend.prodpilot.integrations.github_client.GitHubClient.create_issue") as mock_create:
        mock_create.return_value = mock_created

        payload = {
            "title": "Frontend UI glitch on Safari",
            "body": "Modal does not center properly",
            "labels": ["ui"],
            "assignees": [],
        }
        res = client.post(f"/projects/{sample_project['id']}/issues", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["ok"] is True
        assert data["issue_number"] == 42


def test_update_project_issue(sample_project):
    mock_updated = {
        "ok": True,
        "issue_number": 42,
        "state": "closed",
        "html_url": "https://github.com/testowner/testrepo/issues/42",
        "issue": {
            "id": "1042",
            "number": 42,
            "title": "Frontend UI glitch on Safari (Resolved)",
            "body": "Fixed in patch release",
            "state": "CLOSED",
            "state_reason": "completed",
            "author": "tester",
            "author_avatar": "",
            "labels": [],
            "assignees": [],
            "comments_count": 1,
            "created_at": "2026-10-24T05:00:00Z",
            "updated_at": "2026-10-24T05:30:00Z",
            "closed_at": "2026-10-24T05:30:00Z",
            "html_url": "https://github.com/testowner/testrepo/issues/42",
        },
    }

    with patch("backend.prodpilot.integrations.github_client.GitHubClient.update_issue") as mock_update:
        mock_update.return_value = mock_updated

        payload = {
            "title": "Frontend UI glitch on Safari (Resolved)",
            "body": "Fixed in patch release",
            "state": "closed",
            "state_reason": "completed",
        }
        res = client.patch(f"/projects/{sample_project['id']}/issues/42", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["ok"] is True
        assert data["issue"]["state"] == "CLOSED"


def test_issue_comments_endpoints(sample_project):
    mock_comments = [
        {
            "id": "501",
            "author": "sre-bot",
            "author_avatar": "https://avatars.githubusercontent.com/u/999",
            "body": "### Automated Health Check\nAll services operational.",
            "created_at": "2026-10-24T02:00:00Z",
            "updated_at": "2026-10-24T02:00:00Z",
            "html_url": "https://github.com/testowner/testrepo/issues/42#issuecomment-501",
        }
    ]

    with patch("backend.prodpilot.integrations.github_client.GitHubClient.get_issue_comments") as mock_get_c:
        mock_get_c.return_value = {"ok": True, "comments": mock_comments, "count": 1}

        res = client.get(f"/projects/{sample_project['id']}/issues/42/comments")
        assert res.status_code == 200
        data = res.json()
        assert data["ok"] is True
        assert len(data["comments"]) == 1
        assert "Automated Health Check" in data["comments"][0]["body"]

    with patch("backend.prodpilot.integrations.github_client.GitHubClient.add_issue_comment") as mock_add_c:
        mock_add_c.return_value = {
            "ok": True,
            "comment_id": 502,
            "comment": {
                "id": "502",
                "author": "damu007",
                "author_avatar": "",
                "body": "Deploying hotfix now.",
                "created_at": "2026-10-24T02:05:00Z",
                "updated_at": "2026-10-24T02:05:00Z",
                "html_url": "https://github.com/testowner/testrepo/issues/42#issuecomment-502",
            },
        }

        res = client.post(
            f"/projects/{sample_project['id']}/issues/42/comments",
            json={"body": "Deploying hotfix now."},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["ok"] is True
        assert data["comment"]["id"] == "502"
