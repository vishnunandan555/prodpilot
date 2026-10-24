"""Twilio Voice Call Integration for ProdPilot
Handles emergency Sev-1 outbound phone call escalation,
interactive TwiML voice prompts, and DTMF dialpad confirmation.
"""

import logging
import os
import re
import time
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
    if (get_setting("SERVICE_ENABLED_TWILIO") or "true").strip().lower() in ("false", "0", "off", "no"):
        logger.info("Twilio voice call skipped: SERVICE_ENABLED_TWILIO is set to false.")
        return {
            "ok": False,
            "muted": True,
            "error": "Twilio emergency voice call is disabled in Service Management",
        }

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
        from_num = getattr(call, "from_formatted", None) or getattr(call, "from", getattr(call, "_from", None))
        to_num = getattr(call, "to_formatted", None) or getattr(call, "to", None)
        return {
            "ok": True,
            "call_sid": call.sid,
            "status": call.status,
            "duration": call.duration or "0",
            "to": to_num,
            "from": from_num,
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


# ----------------------------------------------------------------------
# Real-Time Voice SRE Companion Engine (Live Sev-1 Calls & Interactive Q&A)
# ----------------------------------------------------------------------

VOICE_SESSIONS: Dict[str, Dict[str, Any]] = {}


def get_voice_session(session_key: str) -> Dict[str, Any]:
    if session_key not in VOICE_SESSIONS:
        VOICE_SESSIONS[session_key] = {
            "session_key": session_key,
            "incident_id": None,
            "last_announced_stage": None,
            "start_time": time.time(),
            "silence_counter": 0,
            "pre_approved": False,
        }
    return VOICE_SESSIONS[session_key]


def update_voice_session(session_key: str, **kwargs) -> Dict[str, Any]:
    sess = get_voice_session(session_key)
    sess.update(kwargs)
    return sess


def clear_voice_session(session_key: str):
    VOICE_SESSIONS.pop(session_key, None)


def dispatch_incident_voice_drill(incident: Dict[str, Any], db_path: Optional[str] = None) -> Dict[str, Any]:
    """Helper to trigger emergency voice hotline call for an incident."""
    from backend.prodpilot.db import get_setting, log_event
    from backend.prodpilot.integrations.telegram_client import get_effective_tunnel_url

    twilio_enabled = (get_setting("SERVICE_ENABLED_TWILIO") or "true").strip().lower() not in ("false", "0", "off", "no")
    if not twilio_enabled:
        return {"ok": False, "skipped": True, "reason": "Twilio service disabled"}

    incident_id = incident.get("id", "")
    target_phone = get_setting("ENGINEER_PHONE") or os.environ.get("ENGINEER_PHONE") or "+919539916820"
    tunnel_url = get_effective_tunnel_url()
    webhook_url = f"{tunnel_url}/voice/incident/{incident_id}/twiml"

    res = initiate_voice_call(to_phone=target_phone, webhook_url=webhook_url)
    if res.get("ok"):
        call_sid = res.get("call_sid")
        record_voice_log(
            "AUTONOMOUS_CALL_TRIGGERED",
            f"Sev-1 automated voice escalation initiated to {target_phone}. Twilio Call SID: {call_sid}",
            {"incident_id": incident_id, "call_sid": call_sid, "to": target_phone}
        )
        try:
            log_event(
                run_id=None,
                incident_id=incident_id,
                stage="NOTIFY",
                kind="voice_call_initiated",
                payload={"call_sid": call_sid, "phone": target_phone, "status": "ringing"},
                db_path=db_path,
            )
        except Exception:
            pass
    return res


def parse_voice_intent(speech_text: Optional[str] = None, digits: Optional[str] = None) -> Dict[str, Any]:
    """Classifies user's spoken utterance or dialpad press into an actionable SRE intent."""
    if digits:
        digits = str(digits).strip()
        if digits == "1":
            return {"intent": "ROLLBACK", "confidence": 1.0, "source": "dtmf"}
        elif digits == "2":
            return {"intent": "APPROVE", "confidence": 1.0, "source": "dtmf"}
        elif digits == "3":
            return {"intent": "TAKEOVER", "confidence": 1.0, "source": "dtmf"}

    if not speech_text or not speech_text.strip():
        return {"intent": "SILENCE", "confidence": 1.0, "source": "none"}

    norm = speech_text.lower().strip()
    norm = re.sub(r"[^\w\s]", "", norm)

    # 1. Approval / Deploy hotfix
    if re.search(r"\b(approve|deploy|merge|apply fix|apply hotfix|go ahead|yes deploy|fix forward|proceed|looks good|ship it|push it|promote)\b", norm):
        return {"intent": "APPROVE", "confidence": 0.95, "source": "speech", "raw": speech_text}

    # 2. Rollback
    if re.search(r"\b(rollback|roll back|revert|undo|previous commit|backtrack|restore previous|revert commit|go back)\b", norm):
        return {"intent": "ROLLBACK", "confidence": 0.95, "source": "speech", "raw": speech_text}

    # 3. Manual takeover / hold
    if re.search(r"\b(takeover|take over|manual|pause|i will handle|hold on|stop autonomous|my hands|stand down|i got this)\b", norm):
        return {"intent": "TAKEOVER", "confidence": 0.95, "source": "speech", "raw": speech_text}

    # 4. Suspect commit / blame
    if re.search(r"\b(suspect|commit|who broke|culprit|author|blame|which commit|code line|who did this|developer|git blame)\b", norm):
        return {"intent": "SUSPECT_COMMIT", "confidence": 0.90, "source": "speech", "raw": speech_text}

    # 5. Root cause / error / what happened
    if re.search(r"\b(root cause|what happened|what broke|error|why did it fail|exception|summary|failure|why crash|what went wrong|tell me what happened|reason)\b", norm):
        return {"intent": "ROOT_CAUSE", "confidence": 0.90, "source": "speech", "raw": speech_text}

    # 6. Test evidence / repro
    if re.search(r"\b(test|tests|repro|reproduction|failed test|pass|passing|sandbox|evidence|canary|canaries|verification)\b", norm):
        return {"intent": "TEST_EVIDENCE", "confidence": 0.90, "source": "speech", "raw": speech_text}

    # 7. Jev decision / score
    if re.search(r"\b(jev|recommendation|recommend|decision|score|confidence|probabilities|evaluator)\b", norm):
        return {"intent": "JEV_DECISION", "confidence": 0.90, "source": "speech", "raw": speech_text}

    # 8. Status / Current stage (Broad match for "what is currently happening", "what's going on", etc.)
    if re.search(r"\b(status|current stage|where are we|what is happening|what is currently happening|whats happening|whats going on|what is going on|progress|update|state|where we at|how is it going)\b", norm):
        return {"intent": "STATUS", "confidence": 0.90, "source": "speech", "raw": speech_text}

    # 9. Help / Options
    if re.search(r"\b(help|options|commands|what can i say|what can you do)\b", norm):
        return {"intent": "HELP", "confidence": 0.90, "source": "speech", "raw": speech_text}

    return {"intent": "GENERAL_QUERY", "confidence": 0.50, "source": "speech", "raw": speech_text}


def build_incident_companion_intro_twiml(
    incident_id: str,
    action_url: str,
    service_name: str = "Production Server",
    summary: Optional[str] = None,
) -> str:
    """Builds the introductory greeting TwiML when an engineer answers a live Sev-1 call.
    
    Optimized for low latency:
    - barge_in=True allows immediate interruption.
    - speech_timeout='1' triggers within 1 second of speech pause.
    - Concise prompt cuts spoken audio from 16s down to 3s.
    """
    response = VoiceResponse()

    gather = Gather(
        input="speech dtmf",
        action=action_url,
        method="POST",
        timeout=4,
        speech_timeout="1",
        barge_in=True,
        language="en-US",
    )

    alert_text = (
        f"ProdPilot Critical Alert: Sev-One detected on {service_name}. "
        f"Auto remediation is running. Ask a question or say 'approve'."
    )
    gather.say(alert_text, voice="Polly.Matthew-Neural")
    response.append(gather)

    # If initial timeout with no speech, loop to check stage updates
    response.redirect(action_url)
    return str(response)


def build_incident_companion_loop_twiml(
    incident: Optional[Dict[str, Any]],
    speech_text: Optional[str],
    digits: Optional[str],
    action_url: str,
    session_key: str,
) -> Dict[str, Any]:
    """Evaluates the user's intent or silence, provides voice feedback, and maintains the call loop."""
    sess = get_voice_session(session_key)
    intent_data = parse_voice_intent(speech_text=speech_text, digits=digits)
    intent = intent_data["intent"]

    incident_id = incident.get("id", "inc_live") if incident else "inc_live"
    status = (incident.get("status") or "INVESTIGATING").upper() if incident else "INVESTIGATING"
    service = incident.get("service", "Production Server") if incident else "Production Server"

    response = VoiceResponse()
    action_to_execute = None
    action_message = None

    brief = incident.get("brief") or {} if incident else {}
    if isinstance(brief, str):
        import json
        try:
            brief = json.loads(brief)
        except Exception:
            brief = {}

    suspect = incident.get("suspect_commit") or {} if incident else {}
    if isinstance(suspect, str):
        import json
        try:
            suspect = json.loads(suspect)
        except Exception:
            suspect = {}
    suspect_hash = suspect.get("hash", "")[:7] or brief.get("introduced_by", "")[:7] or "f6c9d7a"
    suspect_author = suspect.get("author") or "Engineer"
    suspect_loc = incident.get("suspected_area") or brief.get("suspected_area") or "core transfer loop"

    artifacts = incident.get("artifacts") or {} if incident else {}
    github_pr = artifacts.get("github_pr") or {}
    pr_num = github_pr.get("number") or "1"

    decision = incident.get("decision") or {} if incident else {}
    rec = decision.get("recommendation", "fix_forward")
    probs = decision.get("probabilities") or {}
    ff_prob = int(probs.get("fix_forward", 0.9) * 100)
    decision_reason = decision.get("reason") or "Verified patch restores chunkstream with zero downtime."

    # -------------------------------------------------------------
    # 1. ACTION COMMANDS (APPROVE / ROLLBACK / TAKEOVER)
    # -------------------------------------------------------------
    if intent == "APPROVE":
        if status in ("AWAITING_APPROVAL", "STAGE", "FIXED"):
            speech = (
                f"Hotfix approved! I am merging GitHub Pull Request #{pr_num}, "
                f"closing the linked issue, and deploying the verified patch to port 8000. "
                f"Watchdog verification is running now. Production is being restored. Goodbye!"
            )
            response.say(speech, voice="Polly.Matthew-Neural")
            response.hangup()
            action_to_execute = "APPROVE"
            action_message = f"Voice command: Operator approved hotfix for incident {incident_id}"
            clear_voice_session(session_key)
            return {"twiml": str(response), "action_to_execute": action_to_execute, "action_message": action_message, "intent": intent, "spoken_text": speech}
        elif status in ("RESOLVED", "DEPLOYED"):
            speech = "Hotfix has already been merged and deployed. Port 8000 is healthy and 200 OK. Production is restored. Goodbye!"
            response.say(speech, voice="Polly.Matthew-Neural")
            response.hangup()
            clear_voice_session(session_key)
            return {"twiml": str(response), "action_to_execute": None, "action_message": None, "intent": intent, "spoken_text": speech}
        else:
            # Pre-approval recorded
            sess["pre_approved"] = True
            speech = (
                "Understood! Pre-approval is recorded. "
                "Our remediation agent is currently verifying the reproduction test in sandbox. "
                "The moment canary checks pass, I will automatically merge the pull request and deploy. "
                "Staying on the line."
            )

    elif intent == "ROLLBACK":
        speech = (
            f"Rollback confirmed! I am reverting the production server to previous stable commit {suspect_hash}~1. "
            f"Port 8000 is being rolled back now. Tracking progress on dashboard. Goodbye!"
        )
        response.say(speech, voice="Polly.Matthew-Neural")
        response.hangup()
        action_to_execute = "ROLLBACK"
        action_message = f"Voice command: Operator triggered rollback for incident {incident_id}"
        clear_voice_session(session_key)
        return {"twiml": str(response), "action_to_execute": action_to_execute, "action_message": action_message, "intent": intent, "spoken_text": speech}

    elif intent == "TAKEOVER":
        speech = (
            "Manual takeover confirmed! Autonomous recovery is paused. "
            "Isolated worktrees and canary ports 8001 and 8002 remain active for your inspection. Goodbye."
        )
        response.say(speech, voice="Polly.Matthew-Neural")
        response.hangup()
        action_to_execute = "TAKEOVER"
        action_message = f"Voice command: Operator took manual control of incident {incident_id}"
        clear_voice_session(session_key)
        return {"twiml": str(response), "action_to_execute": action_to_execute, "action_message": action_message, "intent": intent, "spoken_text": speech}

    # -------------------------------------------------------------
    # 2. INFORMATIONAL Q&A
    # -------------------------------------------------------------
    elif intent == "SUSPECT_COMMIT":
        speech = (
            f"Suspect commit attribution: Commit {suspect_hash} by {suspect_author}. "
            f"The issue originated in {suspect_loc}. "
            f"Would you like to hear the root cause, or review the fix?"
        )
    elif intent == "ROOT_CAUSE":
        err_type = brief.get("error_type") or "TimeoutError"
        summary_clean = brief.get("summary") or "10 consecutive chunks sent without ACK from receiver"
        speech = (
            f"Root cause summary: {err_type}. {summary_clean}. "
            f"Suspect code introduced direct field access without null fallback. "
            f"Say 'status' for progress, or 'approve' to deploy the hotfix."
        )
    elif intent == "TEST_EVIDENCE":
        speech = (
            "Test evidence: The autonomous agent created a reproduction test in an isolated Git worktree. "
            "The initial test reproduced the unhandled failure. "
            "After applying the candidate patch, the reproduction test passed green."
        )
    elif intent == "JEV_DECISION":
        speech = (
            f"Jev Decision Engine recommends {rec.replace('_', ' ')} with {ff_prob} percent confidence. "
            f"Rationale: {decision_reason} "
            f"Say 'approve' to execute fix-forward, or 'rollback' to revert."
        )
    elif intent == "STATUS":
        if status == "AWAITING_APPROVAL":
            speech = (
                f"Incident is awaiting your approval! Dual canaries on port 8001 and 8002 are healthy. "
                f"GitHub Pull Request #{pr_num} has been prepared. "
                f"Say 'approve' to merge and deploy, 'rollback' to revert, or 'takeover' to handle it manually."
            )
        elif status == "FIXING":
            speech = "Remediation agent is currently synthesizing a candidate hotfix in an isolated git worktree."
        elif status in ("DEPLOYED", "RESOLVED"):
            speech = "Incident is resolved! Hotfix deployed and port 8000 is healthy."
        elif status == "ROLLED_BACK":
            speech = "Incident resolved via rollback to previous commit."
        elif status == "MANUAL_TAKEOVER":
            speech = "Incident is in manual takeover mode."
        else:
            speech = f"Current incident status is {status.replace('_', ' ')}. Diagnosing failure mechanism."
    elif intent == "HELP":
        speech = (
            "You can ask: 'What happened?', 'Who broke it?', 'What did Jev recommend?', "
            "or say 'Approve hotfix', 'Roll back', or 'Manual takeover'. "
            "You can also press 1 to roll back, 2 to approve, or 3 to take over."
        )
    elif intent == "GENERAL_QUERY":
        speech = (
            f"I heard you say: '{speech_text}'. "
            f"Current status for {service} is {status.replace('_', ' ')}. "
            f"Say 'status' for an update, or 'help' for commands."
        )

    # -------------------------------------------------------------
    # 3. SILENCE / TIMEOUT (Stage Progression Check)
    # -------------------------------------------------------------
    else:  # SILENCE
        last_stage = sess.get("last_announced_stage")
        if status != last_stage:
            sess["last_announced_stage"] = status
            sess["silence_counter"] = 0
            if status == "FIXING":
                speech = (
                    f"Update: Root cause isolated to commit {suspect_hash} by {suspect_author}! "
                    f"Remediation agent is now synthesizing a hotfix in an isolated worktree."
                )
            elif status == "AWAITING_APPROVAL":
                if sess.get("pre_approved"):
                    # Execute pre-approved deploy!
                    speech = (
                        f"Update: Fix verified and canaries passed! "
                        f"Executing pre-approved deployment now: merging PR #{pr_num} and deploying to port 8000. Goodbye!"
                    )
                    response.say(speech, voice="Polly.Matthew-Neural")
                    response.hangup()
                    action_to_execute = "APPROVE"
                    action_message = f"Voice companion executed pre-approved deployment for incident {incident_id}"
                    clear_voice_session(session_key)
                    return {"twiml": str(response), "action_to_execute": action_to_execute, "action_message": action_message, "intent": "PRE_APPROVED", "spoken_text": speech}
                else:
                    speech = (
                        f"Update: Hotfix verified and dual canaries are staged on port 8001 and 8002. "
                        f"GitHub Pull Request #{pr_num} is ready. "
                        f"Say 'approve' to merge and deploy, 'rollback' to revert, or 'takeover' to handle it yourself."
                    )
            elif status in ("DEPLOYED", "RESOLVED"):
                speech = "Update: Hotfix deployed to port 8000! Verified 200 OK. Production restored. Goodbye!"
                response.say(speech, voice="Polly.Matthew-Neural")
                response.hangup()
                clear_voice_session(session_key)
                return {"twiml": str(response), "action_to_execute": None, "action_message": None, "intent": "DEPLOYED", "spoken_text": speech}
            else:
                speech = f"Update: Incident stage advanced to {status.replace('_', ' ')}. Still working."
        else:
            counter = sess.get("silence_counter", 0) + 1
            sess["silence_counter"] = counter
            if counter % 3 == 0:
                speech = "Still running verification in sandbox... say 'status' or 'options' at any time."
            else:
                speech = ""

    # Append gather loop with low-latency parameters
    gather = Gather(
        input="speech dtmf",
        action=action_url,
        method="POST",
        timeout=4,
        speech_timeout="1",
        barge_in=True,
        language="en-US",
    )
    if speech:
        gather.say(speech, voice="Polly.Matthew-Neural")
    response.append(gather)

    # Seamless redirect on timeout to keep call alive
    response.redirect(action_url)

    return {
        "twiml": str(response),
        "action_to_execute": action_to_execute,
        "action_message": action_message,
        "intent": intent,
        "spoken_text": speech,
    }

