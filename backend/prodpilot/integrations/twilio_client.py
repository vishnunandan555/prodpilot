"""Twilio Voice Call Integration for ProdPilot
Handles emergency Sev-1 outbound phone call escalation,
interactive TwiML voice prompts, and DTMF dialpad confirmation.
"""

import logging
import os
from typing import Any, Dict, Optional

from twilio.rest import Client
from twilio.twiml.voice_response import Gather, VoiceResponse

from backend.prodpilot.db import get_setting

logger = logging.getLogger(__name__)


def get_twilio_credentials() -> Dict[str, Optional[str]]:
    sid = get_setting("TWILIO_ACCOUNT_SID") or os.environ.get("TWILIO_ACCOUNT_SID")
    token = get_setting("TWILIO_AUTH_TOKEN") or os.environ.get("TWILIO_AUTH_TOKEN")
    from_num = get_setting("TWILIO_FROM_NUMBER") or os.environ.get("TWILIO_FROM_NUMBER")
    return {
        "sid": sid.strip() if sid else None,
        "token": token.strip() if token else None,
        "from_number": from_num.strip() if from_num else None,
    }


def get_twilio_client() -> Optional[Client]:
    creds = get_twilio_credentials()
    if creds["sid"] and creds["token"]:
        try:
            return Client(creds["sid"], creds["token"])
        except Exception as e:
            logger.error("Failed to initialize Twilio client: %s", e)
    return None


def verify_twilio_credentials() -> Dict[str, Any]:
    """Tests Twilio credentials against the Twilio REST API."""
    creds = get_twilio_credentials()
    if not creds["sid"] or not creds["token"]:
        return {
            "ok": False,
            "status": "UNCONFIGURED",
            "error": "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required in Settings or .env",
        }

    try:
        client = Client(creds["sid"], creds["token"])
        account = client.api.accounts(creds["sid"]).fetch()
        return {
            "ok": True,
            "status": "ONLINE",
            "friendly_name": account.friendly_name,
            "account_status": account.status,
            "from_number": creds["from_number"],
            "message": f"Twilio account '{account.friendly_name}' ({account.status}) verified",
        }
    except Exception as e:
        return {
            "ok": False,
            "status": "ERROR",
            "error": f"Twilio authentication failed: {e}",
        }


def initiate_voice_call(to_phone: str, webhook_url: str) -> Dict[str, Any]:
    """Places an outbound voice call to the target phone number."""
    client = get_twilio_client()
    creds = get_twilio_credentials()
    if not client or not creds["from_number"]:
        return {
            "ok": False,
            "error": "Twilio is not configured with valid Account SID, Auth Token, and From Number.",
        }

    try:
        call = client.calls.create(
            to=to_phone,
            from_=creds["from_number"],
            url=webhook_url,
        )
        logger.info("Twilio voice call triggered: Call SID=%s to %s", call.sid, to_phone)
        return {
            "ok": True,
            "call_sid": call.sid,
            "status": call.status,
            "to": to_phone,
            "from": creds["from_number"],
        }
    except Exception as e:
        logger.error("Failed to place Twilio voice call: %s", e)
        return {
            "ok": False,
            "error": str(e),
        }


def build_incident_twiml(
    incident_id: str,
    action_url: str,
    service_name: str = "Production Server",
    summary: Optional[str] = None,
) -> str:
    """Builds interactive TwiML XML asking for dialpad confirmation."""
    response = VoiceResponse()

    # Pause 1 second for call audio stabilization
    response.pause(length=1)

    gather = Gather(
        num_digits=1,
        action=action_url,
        method="POST",
        timeout=10,
    )

    alert_speech = (
        f"ProdPilot Critical Incident Alert! "
        f"Service {service_name} is failing health checks. "
    )
    if summary:
        alert_speech += f"Root cause summary: {summary}. "

    alert_speech += (
        "Recovery options are prepared. "
        "Press 1 on your keypad to immediately roll back to the previous stable release. "
        "Press 2 to approve and deploy the staged automated hotfix. "
        "Press 3 to acknowledge and take over manually."
    )

    gather.say(alert_speech, voice="Polly.Matthew-Neural")
    response.append(gather)

    # Fallback if no digit pressed
    response.say(
        "No selection detected. ProdPilot will repeat options once.",
        voice="Polly.Matthew-Neural",
    )
    response.redirect(f"{action_url}?retry=1")

    return str(response)


def build_action_twiml(digit: str) -> str:
    """Builds confirmation TwiML response based on the pressed key."""
    response = VoiceResponse()

    if digit == "1":
        response.say(
            "Rollback confirmed. ProdPilot is initiating deployment to the previous stable commit. "
            "Track progress on your live dashboard. Goodbye.",
            voice="Polly.Matthew-Neural",
        )
    elif digit == "2":
        response.say(
            "Hotfix confirmed. ProdPilot is merging the patch PR and triggering production deploy. "
            "Track verification watchdog on your mobile dashboard. Goodbye.",
            voice="Polly.Matthew-Neural",
        )
    elif digit == "3":
        response.say(
            "Incident acknowledged. Automated recovery is paused for manual investigation. Goodbye.",
            voice="Polly.Matthew-Neural",
        )
    else:
        response.say(
            "Unrecognized option. Incident left untouched. Goodbye.",
            voice="Polly.Matthew-Neural",
        )

    response.hangup()
    return str(response)


def build_test_speech_twiml(action_url: str) -> str:
    """Builds interactive TwiML for testing Speech-to-Text (STT) and echo."""
    response = VoiceResponse()
    response.pause(length=1)

    gather = Gather(
        input="speech",
        action=action_url,
        method="POST",
        timeout=6,
        speech_timeout="auto",
        language="en-US",
    )
    gather.say(
        "Welcome to ProdPilot Voice Diagnostics drill! "
        "Please speak any sentence clearly now to test speech recognition.",
        voice="Polly.Matthew-Neural",
    )
    response.append(gather)

    response.say(
        "No speech was detected. Voice diagnostics drill ended. Goodbye!",
        voice="Polly.Matthew-Neural",
    )
    response.hangup()
    return str(response)


def build_test_echo_twiml(transcribed_text: str) -> str:
    """Echoes back the recognized speech to test Text-to-Speech (TTS)."""
    response = VoiceResponse()
    response.pause(length=1)

    clean_text = (transcribed_text or "").strip()
    if clean_text:
        response.say(
            f"Speech recognition successful! I heard you say: {clean_text}. "
            "Both speech to text and text to speech diagnostics are verified and operational. Have a great day. Goodbye!",
            voice="Polly.Matthew-Neural",
        )
    else:
        response.say(
            "Speech recognition received silence. Diagnostics drill completed. Goodbye!",
            voice="Polly.Matthew-Neural",
        )

    response.hangup()
    return str(response)



# In-memory Voice Testing Event Logs
VOICE_TEST_LOGS = []


def record_voice_log(event_type: str, message: str, meta: Optional[Dict[str, Any]] = None):
    import datetime
    entry = {
        "timestamp": datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3],
        "type": event_type,
        "message": message,
        "meta": meta or {},
    }
    VOICE_TEST_LOGS.append(entry)
    if len(VOICE_TEST_LOGS) > 100:
        VOICE_TEST_LOGS.pop(0)


def get_voice_logs():
    return list(VOICE_TEST_LOGS)


def clear_voice_logs():
    VOICE_TEST_LOGS.clear()


def get_call_status(call_sid: str) -> Dict[str, Any]:
    """Queries live call telemetry directly from Twilio."""
    client = get_twilio_client()
    if not client:
        return {"ok": False, "error": "Twilio client not initialized"}
    try:
        call = client.calls(call_sid).fetch()
        return {
            "ok": True,
            "call_sid": call.sid,
            "status": call.status,
            "duration": call.duration or "0",
            "to": call.to,
            "from": call.from_,
            "start_time": str(call.start_time) if call.start_time else None,
            "end_time": str(call.end_time) if call.end_time else None,
            "price": str(call.price) if call.price else None,
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


def hangup_call(call_sid: str) -> Dict[str, Any]:
    """Terminates an active call."""
    client = get_twilio_client()
    if not client:
        return {"ok": False, "error": "Twilio client not initialized"}
    try:
        call = client.calls(call_sid).update(status="completed")
        record_voice_log("CALL_HANGUP", f"Call {call_sid} terminated by operator.")
        return {"ok": True, "status": call.status}
    except Exception as e:
        return {"ok": False, "error": str(e)}

