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

