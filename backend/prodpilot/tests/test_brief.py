"""Tests for brief extraction logic."""

from backend.prodpilot.pipeline.brief import create_brief, extract_traceback_info


def test_extract_traceback_info():
    trace = """Traceback (most recent call last):
  File "app.py", line 45, in calculate_order
    discount = order["discount"]
KeyError: 'discount'"""
    info = extract_traceback_info(trace)
    assert info["error_type"] == "KeyError"
    assert info["error_message"] == "'discount'"
    assert info["file"] == "app.py"
    assert info["line"] == 45
    assert info["func"] == "calculate_order"


def test_create_brief():
    incident = {
        "id": "inc-test-01",
        "service": "demo-prod",
        "detected_at": "2026-10-23T14:30:00Z",
        "status": "OPEN",
        "trace": "Traceback (most recent call last):\n  File \"app.py\", line 45, in calculate_order\n    discount = order[\"discount\"]\nKeyError: 'discount'",
        "log_tail": "2026-10-23 14:29:59 ERROR KeyError: 'discount' in /orders",
        "recent_commits": [
            {"hash": "a1b2c3d", "author": "Vishnu", "message": "feat: add discount support"}
        ],
        "suspect_commit": {
            "hash": "a1b2c3d",
            "author": "Vishnu",
            "suspect_file": "app.py",
            "suspect_line": 45,
            "minutes_ago": 15,
        },
    }
    brief = create_brief(incident)
    assert "KeyError" in brief["summary"]
    assert brief["suspected_area"] == "app.py:45"
    assert brief["introduced_by"] == "a1b2c3d"
    assert brief["key_name"] == "discount"
    assert brief["suspect_file"] == "app.py"
    assert brief["suspect_line"] == 45
