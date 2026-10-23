"""Tests for Decision Layer (Rules Engine)."""

from backend.prodpilot.decide.rules import decide


def test_decide_both_healthy_small_diff():
    incident = {
        "id": "inc-001",
        "suspect_commit": {"minutes_ago": 15, "suspect_file": "app.py"},
    }
    staging_status = {
        "fix_forward": {"health": True},
        "rollback": {"health": True},
    }
    patch_diff = "+ discount = order.get('discount', 0)\n- discount = order['discount']"

    dec = decide(incident, staging_status, patch_diff=patch_diff)
    assert dec["backend"] == "rules"
    assert dec["recommendation"] == "fix_forward"
    assert dec["probabilities"]["fix_forward"] == 0.85
    assert dec["probabilities"]["rollback"] == 0.15
    assert "Small" in dec["reason"]


def test_decide_only_rollback_healthy():
    incident = {"id": "inc-002"}
    staging_status = {
        "fix_forward": {"health": False},
        "rollback": {"health": True},
    }
    dec = decide(incident, staging_status)
    assert dec["recommendation"] == "rollback"
    assert dec["probabilities"]["rollback"] == 0.95
