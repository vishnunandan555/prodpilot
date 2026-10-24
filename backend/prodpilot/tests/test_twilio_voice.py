"""Unit tests for Twilio Voice Informant and TwiML Endpoints."""

import pytest
from fastapi.testclient import TestClient

from backend.prodpilot.api.server import app
from backend.prodpilot.integrations.twilio_client import (
    build_action_twiml,
    build_incident_twiml,
    get_twilio_credentials,
    verify_twilio_credentials,
)

client = TestClient(app)


def test_build_incident_twiml():
    xml = build_incident_twiml(
        incident_id="inc_unit_1",
        action_url="https://api.prodpilot.net/voice/action?incident_id=inc_unit_1",
        service_name="payment-service",
        summary="ZeroDivisionError in payment processor",
    )
    assert "<Response>" in xml
    assert "<Gather" in xml
    assert "Polly.Matthew-Neural" in xml
    assert "payment-service" in xml
    assert "Press 1" in xml
    assert "Press 2" in xml
    assert "Press 3" in xml


def test_build_action_twiml():
    xml_rollback = build_action_twiml("1")
    assert "Rollback confirmed" in xml_rollback
    assert "<Hangup" in xml_rollback

    xml_fix = build_action_twiml("2")
    assert "Hotfix confirmed" in xml_fix

    xml_ack = build_action_twiml("3")
    assert "Incident acknowledged" in xml_ack


def test_voice_twiml_endpoint():
    response = client.post("/voice/twiml?incident_id=inc_test_99&service=AuthEngine")
    assert response.status_code == 200
    assert "application/xml" in response.headers.get("content-type", "")
    assert "<Response>" in response.text
    assert "AuthEngine" in response.text


def test_voice_action_endpoint():
    response = client.post("/voice/action?incident_id=inc_test_99", data={"Digits": "1"})
    assert response.status_code == 200
    assert "application/xml" in response.headers.get("content-type", "")
    assert "Rollback confirmed" in response.text


def test_voice_test_speech_echo_flow():
    # 1. Twilio hits /voice/test-twiml to begin speech gather
    init_res = client.post("/voice/test-twiml")
    assert init_res.status_code == 200
    assert "application/xml" in init_res.headers.get("content-type", "")
    assert 'input="speech"' in init_res.text
    assert "ProdPilot Voice Diagnostics" in init_res.text

    # 2. Twilio transcribes speech and calls /voice/test-speech-callback
    callback_res = client.post(
        "/voice/test-speech-callback",
        data={"SpeechResult": "500 Internal Server Error in payment gateway", "Confidence": "0.95"}
    )
    assert callback_res.status_code == 200
    assert "application/xml" in callback_res.headers.get("content-type", "")
    assert "500 Internal Server Error in payment gateway" in callback_res.text
    assert "Speech recognition successful" in callback_res.text


def test_parse_voice_intent():
    from backend.prodpilot.integrations.twilio_client import parse_voice_intent

    # DTMF digits
    assert parse_voice_intent(digits="1")["intent"] == "ROLLBACK"
    assert parse_voice_intent(digits="2")["intent"] == "APPROVE"
    assert parse_voice_intent(digits="3")["intent"] == "TAKEOVER"

    # Spoken commands
    assert parse_voice_intent(speech_text="approve and deploy the hotfix")["intent"] == "APPROVE"
    assert parse_voice_intent(speech_text="roll back to the previous commit")["intent"] == "ROLLBACK"
    assert parse_voice_intent(speech_text="manual takeover I will handle it")["intent"] == "TAKEOVER"

    # Spoken queries
    assert parse_voice_intent(speech_text="what is the suspect commit?")["intent"] == "SUSPECT_COMMIT"
    assert parse_voice_intent(speech_text="tell me the root cause")["intent"] == "ROOT_CAUSE"
    assert parse_voice_intent(speech_text="what tests failed?")["intent"] == "TEST_EVIDENCE"
    assert parse_voice_intent(speech_text="what did jev recommend?")["intent"] == "JEV_DECISION"
    assert parse_voice_intent(speech_text="what is the current status?")["intent"] == "STATUS"
    assert parse_voice_intent(speech_text="help me what can I say")["intent"] == "HELP"

    # Silence
    assert parse_voice_intent(speech_text="")["intent"] == "SILENCE"


def test_voice_companion_incident_flow():
    # 1. Entry webhook when phone answered
    entry_res = client.post("/voice/incident/inc-unit-test-companion/twiml")
    assert entry_res.status_code == 200
    assert "<Response>" in entry_res.text
    assert "ProdPilot Critical Alert" in entry_res.text
    assert 'input="speech dtmf"' in entry_res.text
    assert 'bargeIn="true"' in entry_res.text
    assert 'speechTimeout="1"' in entry_res.text
    assert "/voice/incident/inc-unit-test-companion/loop" in entry_res.text

    # 2. Spoken Q&A: "Who broke it?"
    qa_res = client.post(
        "/voice/incident/inc-unit-test-companion/loop",
        data={"SpeechResult": "Who broke it what is the suspect commit?", "Confidence": "0.94"},
    )
    assert qa_res.status_code == 200
    assert "Suspect commit attribution" in qa_res.text
    assert 'input="speech dtmf"' in qa_res.text

    # 3. Spoken Q&A: "What did Jev recommend?"
    jev_res = client.post(
        "/voice/incident/inc-unit-test-companion/loop",
        data={"SpeechResult": "What does Jev decision recommend?", "Confidence": "0.92"},
    )
    assert jev_res.status_code == 200
    assert "Jev Decision Engine recommends" in jev_res.text

    # 4. Spoken Command: "Take over manually"
    takeover_res = client.post(
        "/voice/incident/inc-unit-test-companion/loop",
        data={"SpeechResult": "I want manual takeover", "Confidence": "0.95"},
    )
    assert takeover_res.status_code == 200
    assert "Manual takeover confirmed" in takeover_res.text
    assert "<Hangup" in takeover_res.text


def test_active_voice_call_and_step_transitions():
    # 1. Check initial active call endpoint
    res = client.get("/voice/active-call")
    assert res.status_code == 200
    data = res.json()
    assert "step" in data
    assert "step_label" in data
    assert "duration" in data

    # 2. Simulate step transition: Launching
    sim_launch = client.post(
        "/voice/simulate-step",
        json={"step": "LAUNCHING", "incident_id": "inc-test-123"}
    )
    assert sim_launch.status_code == 200
    status_launch = client.get("/voice/active-call").json()
    assert status_launch["step"] == "LAUNCHING"
    assert status_launch["step_label"] == "Launching Call..."

    # 3. Simulate step transition: AI_SPEAKING
    sim_speak = client.post(
        "/voice/simulate-step",
        json={"step": "AI_SPEAKING", "incident_id": "inc-test-123"}
    )
    assert sim_speak.status_code == 200
    status_speak = client.get("/voice/active-call").json()
    assert status_speak["step"] == "AI_SPEAKING"
    assert status_speak["step_label"] == "AI Speaking..."
    assert status_speak["is_active"] is True

    # 4. Simulate step transition: USER_SPEAKING
    sim_user = client.post(
        "/voice/simulate-step",
        json={"step": "USER_SPEAKING", "speech": "approve hotfix", "incident_id": "inc-test-123"}
    )
    assert sim_user.status_code == 200
    status_user = client.get("/voice/active-call").json()
    assert status_user["step"] == "USER_SPEAKING"
    assert 'approve hotfix' in status_user["step_label"]

    # 5. Simulate call end
    sim_ended = client.post(
        "/voice/simulate-step",
        json={"step": "ENDED"}
    )
    assert sim_ended.status_code == 200
    status_ended = client.get("/voice/active-call").json()
    assert status_ended["step"] == "ENDED"
    assert status_ended["step_label"] == "Call Ended"


def test_voice_status_callback_and_reset():
    # 1. Simulate an active call
    client.post("/voice/simulate-step", json={"step": "CALL_ACTIVE", "call_sid": "CA_test_sid"})
    status = client.get("/voice/active-call").json()
    assert status["is_active"] is True

    # 2. Twilio sends carrier status callback on user disconnect
    cb_res = client.post(
        "/voice/status-callback",
        data={"CallSid": "CA_test_sid", "CallStatus": "completed", "CallDuration": "42"}
    )
    assert cb_res.status_code == 200
    assert "<Response>" in cb_res.text

    # Active call should now be ENDED
    status_after_cb = client.get("/voice/active-call").json()
    assert status_after_cb["step"] == "ENDED"
    assert status_after_cb["status"] == "completed"

    # 3. Force-reset call endpoint
    reset_res = client.post("/voice/reset-call")
    assert reset_res.status_code == 200
    assert reset_res.json()["ok"] is True
    status_after_reset = client.get("/voice/active-call").json()
    assert status_after_reset["step"] == "IDLE"
    assert status_after_reset["status"] == "idle"
    assert status_after_reset["duration"] == 0



