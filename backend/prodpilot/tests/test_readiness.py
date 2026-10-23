"""Unit and Integration Tests for ProdPilot Issue Readiness Gate & Endpoints
Tests ready vs ambiguous issues and REST endpoints.
"""

from fastapi.testclient import TestClient

from backend.prodpilot.api.server import app
from backend.prodpilot.db import init_db
from backend.prodpilot.pipeline.brief import analyze_issue_readiness


def test_analyze_issue_readiness_ambiguous():
    """Ambiguous issue missing repro steps, error logs, and expected behavior must fail gate."""
    ambiguous_issue = {
        "title": "[CHORE] Refactor auth context and update dependencies",
        "body": "We should probably clean up auth context sometime soon.",
        "author": "developer_alice",
        "repo": "demo-prod",
    }

    result = analyze_issue_readiness(ambiguous_issue)

    assert result["ready"] is False
    assert len(result["clarifying_questions"]) == 3
    # Check that each missing component is queried
    questions_text = " ".join(result["clarifying_questions"]).lower()
    assert "reproduction" in questions_text or "payload" in questions_text
    assert "error" in questions_text or "log" in questions_text or "trace" in questions_text
    assert "expected" in questions_text

    # Verify drafted comment is polite markdown
    assert "@developer_alice" in result["draft_comment"]
    assert "clarify the following details" in result["draft_comment"]
    assert "- " in result["draft_comment"]


def test_analyze_issue_readiness_partial():
    """Issue with repro and expected behavior but missing error logs must fail gate."""
    partial_issue = {
        "title": "[BUG] Checkout fails on empty cart",
        "body": (
            "Steps to reproduce: Call POST /orders with payload: {'items': []}.\n"
            "Expected behavior: The API should return 400 Bad Request with error detail."
        ),
        "author": "bob",
    }

    result = analyze_issue_readiness(partial_issue)

    assert result["ready"] is False
    assert len(result["clarifying_questions"]) == 1
    assert "error" in result["clarifying_questions"][0].lower() or "log" in result["clarifying_questions"][0].lower()
    assert result["draft_comment"] != ""


def test_analyze_issue_readiness_ready():
    """Well-specified issue with repro, traceback error log, and expected behavior must pass gate."""
    ready_issue = {
        "title": "[BUG] Missing discount key in order payload causes 500 crash",
        "body": (
            "Steps to reproduce:\n"
            "1. Send POST /orders with payload:\n"
            "   curl -X POST http://127.0.0.1:8000/orders -H 'Content-Type: application/json' -d '{\"items\": [{\"id\": \"1\", \"price\": 20.0}]}'\n\n"
            "Error log:\n"
            "Traceback (most recent call last):\n"
            "  File \"app.py\", line 8, in calculate_order\n"
            "    discount = order[\"discount\"]\n"
            "KeyError: 'discount'\n\n"
            "Expected behavior:\n"
            "Endpoint should safely default missing discount to 0 and return 20.0 instead of crashing."
        ),
        "author": "vishnunandan555",
        "repo": "demo-prod",
    }

    result = analyze_issue_readiness(ready_issue)

    assert result["ready"] is True
    assert result["clarifying_questions"] == []
    assert result["draft_comment"] == ""
    assert result["suspected_area"] == "app.py:8"
    assert "Missing discount key" in result["task_summary"]


def test_rest_endpoints_analyze_and_clarify():
    """Verify REST endpoints /issues/{id}/analyze and /issues/{id}/clarify."""
    init_db()
    client = TestClient(app)

    # 1. Analyze seeded ready issue (#1)
    res1 = client.post("/issues/1/analyze")
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["issue_id"] == "1"
    assert data1["ready"] is True
    assert data1["clarifying_questions"] == []
    assert "app.py" in data1["suspected_area"]

    # 2. Analyze seeded ambiguous issue (#2)
    res2 = client.post("/issues/2/analyze")
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["issue_id"] == "2"
    assert data2["ready"] is False
    assert len(data2["clarifying_questions"]) > 0
    assert len(data2["draft_comment"]) > 0

    # 3. Analyze custom issue payload
    custom_payload = {
        "title": "Need more buttons",
        "body": "Can we add some blue buttons somewhere?",
        "author": "designer_dan",
    }
    res3 = client.post("/issues/custom-99/analyze", json=custom_payload)
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3["ready"] is False
    assert "@designer_dan" in data3["draft_comment"]

    # 4. Clarify issue (#2)
    res_clarify = client.post(
        "/issues/2/clarify",
        json={"source": "desktop_ui"},
    )
    assert res_clarify.status_code == 200
    clarify_data = res_clarify.json()
    assert clarify_data["status"] == "posted"
    assert clarify_data["issue_id"] == "2"
    assert clarify_data["posted_to"] == "db"
    assert len(clarify_data["comment"]) > 0
