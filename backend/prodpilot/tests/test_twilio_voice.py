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

