"""Unit tests for ProdPilot 3-Stage Telegram Alert Lifecycle and Mobile Incident Console."""

import pytest
from unittest.mock import patch, MagicMock

from backend.prodpilot.integrations.telegram_client import (
    generate_natural_incident_explanation,
    generate_natural_fix_explanation,
    send_stage1_detection_alert,
    send_stage2_rca_plan_alert,
    send_stage3_approval_alert,
)
from backend.prodpilot.api.mobile_renderer import render_mobile_incident_page


def test_natural_language_explanations():
    # 1. Receiver ACK timeout
    trace_timeout = (
        "TimeoutError: ReceiverAckTimeoutError: Transfer 1964 halted: "
        "10 consecutive chunks sent without ACK from receiver (streak=10) in handle_websocket_message"
    )
    issue_desc = generate_natural_incident_explanation(trace=trace_timeout)
    assert "websocket" in issue_desc.lower()
    assert "timeout" in issue_desc.lower()

    # 2. KeyError
    trace_keyerror = "KeyError: 'discount' in calculate_order"
    issue_desc_key = generate_natural_incident_explanation(trace=trace_keyerror)
    assert "KeyError" in issue_desc_key
    assert "discount" in issue_desc_key

    # 3. Fix explanation
    patch_streak = (
        "+ if ack_received:\n"
        "+     consecutive_unacked = 0\n"
        "+     streak = 0\n"
    )
    fix_desc = generate_natural_fix_explanation(patch_diff=patch_streak)
    assert "streak" in fix_desc.lower() or "acknowledgement" in fix_desc.lower()


@patch("backend.prodpilot.integrations.telegram_client._send_telegram")
def test_send_stage1_detection_alert(mock_send):
    mock_send.return_value = True

    ok = send_stage1_detection_alert(
        incident_id="inc-test-123",
        service_name="chunkstream",
        severity="SEV-1 CRITICAL",
        error_reason="ReceiverAckTimeoutError: 10 consecutive chunks without ACK",
    )
    assert ok is True
    assert mock_send.called
    sent_text, kwargs = mock_send.call_args[0][0], mock_send.call_args[1]
    assert "SEVERE PRODUCTION ERROR DETECTED" in sent_text
    assert "chunkstream" in sent_text
    assert "Agent is analysing the cause..." in sent_text
    # Button should point to live analysis
    markup = kwargs.get("reply_markup", {})
    buttons = markup.get("inline_keyboard", [[]])[0]
    assert any("View Analysis Live" in b.get("text", "") for b in buttons)
    assert any("view=analysis" in b.get("url", "") for b in buttons)


@patch("backend.prodpilot.integrations.telegram_client._send_telegram")
def test_send_stage2_rca_plan_alert(mock_send):
    mock_send.return_value = True

    brief = {
        "summary": "ReceiverAckTimeoutError in handle_websocket_message",
        "suspected_area": "app/transfer.py:412",
        "hypothesis": "Receiver streak limit reached without ACK",
    }
    suspect_commit = {
        "hash": "a1b2c3d4",
        "author": "vishnu",
        "message": "optimize chunk throughput",
    }

    ok = send_stage2_rca_plan_alert(
        incident_id="inc-test-123",
        service_name="chunkstream",
        summary=brief["summary"],
        suspect_commit=suspect_commit,
        suspected_area=brief["suspected_area"],
        brief=brief,
    )
    assert ok is True
    assert mock_send.called
    sent_text, kwargs = mock_send.call_args[0][0], mock_send.call_args[1]
    assert "INCIDENT CREATED: SEV-1 CRITICAL" in sent_text
    assert "What Happened:" in sent_text
    assert "Affected File:" in sent_text
    assert "app/transfer.py:412" in sent_text
    assert "Agent is now trying to generate a fix..." in sent_text
    # Button should point to live remediation
    markup = kwargs.get("reply_markup", {})
    buttons = markup.get("inline_keyboard", [[]])[0]
    assert any("Open Live Remediation" in b.get("text", "") for b in buttons)
    assert any("view=remediation" in b.get("url", "") for b in buttons)


@patch("backend.prodpilot.integrations.telegram_client._send_telegram")
def test_send_stage3_approval_alert(mock_send):
    mock_send.return_value = True

    decision = {
        "recommendation": "fix_forward",
        "probabilities": {"fix_forward": 0.92},
        "reason": "Deterministic repro passed, zero regression blast radius",
    }
    patch_diff = """--- a/app/transfer.py
+++ b/app/transfer.py
@@ -412,6 +412,8 @@
+    if ack_received:
+        streak = 0
"""
    ok = send_stage3_approval_alert(
        incident_id="inc-test-123",
        service_name="chunkstream",
        diff_stats="+2 lines modified",
        patch_diff=patch_diff,
        decision=decision,
        suspected_area="app/transfer.py:412",
    )
    assert ok is True
    assert mock_send.called
    sent_text, kwargs = mock_send.call_args[0][0], mock_send.call_args[1]
    assert "INCIDENT #inc-test-123 — PATCH READY" in sent_text
    assert "Fix Summary:" in sent_text
    assert "Repro Test" in sent_text
    # Buttons: Approve Fix AND Hold
    markup = kwargs.get("reply_markup", {})
    buttons = markup.get("inline_keyboard", [[]])[0]
    button_texts = [b.get("text", "") for b in buttons]
    assert any("Approve Fix" in t for t in button_texts)
    assert any("Hold" in t for t in button_texts)
    # Check URLs
    approve_btn = [b for b in buttons if "Approve Fix" in b["text"]][0]
    hold_btn = [b for b in buttons if "Hold" in b["text"]][0]
    assert "action=approve_modal" in approve_btn["url"]
    assert "action=hold" in hold_btn["url"]


def test_mobile_renderer_modes():
    mock_data = {
        "id": "inc-test-456",
        "service": "chunkstream",
        "status": "AWAITING_APPROVAL",
        "brief": {
            "summary": "ReceiverAckTimeoutError in handle_websocket_message",
            "suspected_area": "app/transfer.py:412",
        },
        "artifacts": {
            "patch_diff": "--- a/app.py\n+++ b/app.py\n+ # fix\n",
        },
        "events": [
            {"stage": "UNDERSTAND", "kind": "info", "payload": {"message": "Analyzing traceback..."}},
            {"stage": "FIX", "kind": "tool_call", "payload": {"message": "Synthesized patch with guard"}},
        ],
    }

    # 1. Default render
    html_out = render_mobile_incident_page(mock_data)
    assert "ProdPilot" in html_out
    assert "inc-test-456" in html_out
    assert "Hotfix Approval Confirmation" in html_out
    assert "Create PR &amp; Auto-Merge" in html_out or "Create PR & Auto-Merge" in html_out

    # 2. Analysis view
    html_analysis = render_mobile_incident_page(mock_data, view="analysis")
    assert "view-analysis" in html_analysis
    assert "Agent Thinking &amp; Root Cause Analysis" in html_analysis or "Agent Thinking & Root Cause Analysis" in html_analysis

    # 3. Remediation view
    html_remediation = render_mobile_incident_page(mock_data, view="remediation")
    assert "view-remediation" in html_remediation
    assert "Autonomous Remediation Feed" in html_remediation

    # 4. On hold status
    mock_data["status"] = "ON_HOLD"
    html_hold = render_mobile_incident_page(mock_data)
    assert "Incident On Hold" in html_hold
    assert "Resume &amp; Review Fix" in html_hold or "Resume & Review Fix" in html_hold


def test_incident_hold_endpoints():
    from fastapi.testclient import TestClient
    from backend.prodpilot.api.server import app
    from backend.prodpilot.db import create_incident

    client = TestClient(app)
    inc_id = "inc-test-hold-999"

    create_incident(
        incident_id=inc_id,
        service="chunkstream",
        detected_at="2026-10-24T00:00:00",
        status="AWAITING_APPROVAL",
    )

    # 1. Post to /hold
    resp_hold = client.post(f"/incidents/{inc_id}/hold", json={"action": "hold"})
    assert resp_hold.status_code == 200
    assert resp_hold.json()["status"] == "ON_HOLD"

    # Verify status in GET
    detail_res = client.get(f"/incidents/{inc_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["status"] == "ON_HOLD"

    # 2. Query param action=resume via GET
    res_resume = client.get(f"/incidents/{inc_id}?action=resume")
    assert res_resume.status_code == 200

    # 3. Query param action=hold returning HTML
    res_hold_html = client.get(f"/incidents/{inc_id}?action=hold", headers={"Accept": "text/html"})
    assert res_hold_html.status_code == 200
    assert "Incident On Hold" in res_hold_html.text
