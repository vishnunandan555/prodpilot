import React, { useState, useEffect, useRef } from 'react';
import {
  PhoneCall,
  PhoneOff,
  RefreshCw,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Radio,
  Volume2,
  Mic,
  Terminal,
  Activity,
  ArrowRight,
  ShieldAlert,
  Send,
  Sparkles
} from 'lucide-react';

export default function TwilioCallModal({
  isOpen,
  onClose,
  apiUrl = 'http://127.0.0.1:8765',
  initialCallData = null,
  engineerPhone = '+919539916820',
  twilioFrom = '+17372508034',
}) {
  const [callSid, setCallSid] = useState(initialCallData?.call_sid || null);
  const [callStatus, setCallStatus] = useState(initialCallData?.status || 'initiating');
  const [callError, setCallError] = useState(initialCallData?.error || null);
  const [callDetails, setCallDetails] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hangingUp, setHangingUp] = useState(false);
  const [duration, setDuration] = useState(0);
  const [simulatedSpeech, setSimulatedSpeech] = useState('');
  const [simulatingSpeech, setSimulatingSpeech] = useState(false);

  const logsEndRef = useRef(null);

  // Sync initialCallData
  useEffect(() => {
    if (initialCallData?.call_sid) {
      setCallSid(initialCallData.call_sid);
      setCallStatus(initialCallData.status || 'queued');
      setCallError(null);
    } else if (initialCallData?.status === 'failed' || initialCallData?.error) {
      setCallStatus('failed');
      setCallError(initialCallData.error || 'Failed to place call via Twilio');
    }
  }, [initialCallData]);

  // Duration timer only when call is actively answered/in-progress
  useEffect(() => {
    if (!isOpen) return;
    const isActiveCall = ['in-progress', 'answered'].includes(callStatus?.toLowerCase());
    if (!isActiveCall) return;
    const timer = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, callStatus]);

  // Poll Twilio call status and logs every 1.2s
  useEffect(() => {
    if (!isOpen) return;

    const poll = async () => {
      try {
        const logRes = await fetch(`${apiUrl}/voice/logs`);
        if (logRes.ok) {
          const data = await logRes.json();
          setLogs(data.logs || []);
        }
      } catch (err) {
        console.warn('Failed to poll voice logs:', err);
      }

      if (callSid) {
        try {
          const statusRes = await fetch(`${apiUrl}/voice/call-status/${callSid}`);
          if (statusRes.ok) {
            const data = await statusRes.json();
            if (data.ok) {
              setCallStatus(data.status);
              setCallDetails(data);
            }
          }
        } catch (err) {
          console.warn('Failed to poll call status:', err);
        }
      }
    };

    poll();
    const interval = setInterval(poll, 1200);
    return () => clearInterval(interval);
  }, [isOpen, callSid, apiUrl]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Trigger new test call from inside modal
  const handleRedial = async () => {
    setLoading(true);
    setDuration(0);
    setLogs([]);
    try {
      const res = await fetch(`${apiUrl}/voice/test-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: engineerPhone })
      });
      const data = await res.json();
      if (data.ok) {
        setCallSid(data.call_sid);
        setCallStatus(data.status || 'queued');
        setCallError(null);
      } else {
        setCallStatus('failed');
        setCallError(data.error || 'Failed to place call via Twilio API');
      }
    } catch (err) {
      console.error('Redial error:', err);
      setCallStatus('failed');
      setCallError(err.message || 'Network error while contacting Twilio');
    } finally {
      setLoading(false);
    }
  };

  // Hangup call
  const handleHangup = async () => {
    if (!callSid) return;
    setHangingUp(true);
    try {
      await fetch(`${apiUrl}/voice/hangup/${callSid}`, { method: 'POST' });
      setCallStatus('completed');
    } catch (err) {
      console.error('Hangup error:', err);
    } finally {
      setHangingUp(false);
    }
  };

  // Simulate speech STT directly from UI
  const handleSimulateSpeechSubmit = async (e) => {
    e?.preventDefault();
    const phrase = simulatedSpeech.trim() || 'Production server 500 error in checkout payment flow';
    setSimulatingSpeech(true);
    try {
      const formData = new FormData();
      formData.append('SpeechResult', phrase);
      formData.append('Confidence', '0.96');
      await fetch(`${apiUrl}/voice/test-speech-callback`, {
        method: 'POST',
        body: formData
      });
      setSimulatedSpeech('');
    } catch (err) {
      console.error('Failed to simulate speech callback:', err);
    } finally {
      setSimulatingSpeech(false);
    }
  };

  if (!isOpen) return null;

  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'in-progress':
      case 'answered':
        return 'text-[#3fb950] bg-[#122419] border-[#1f4a2b]';
      case 'ringing':
      case 'queued':
      case 'initiating':
        return 'text-[#79c0ff] bg-[#161f30] border-[#263550] animate-pulse';
      case 'completed':
        return 'text-[#8b949e] bg-[#161b22] border-[#21262d]';
      case 'failed':
      case 'busy':
      case 'no-answer':
        return 'text-[#ff7b72] bg-[#261317] border-[#4a1c24]';
      default:
        return 'text-[#d29922] bg-[#241a12] border-[#442c16]';
    }
  };

  // Find diagnostic events
  const speechLog = [...logs].reverse().find((l) => l.type === 'SPEECH_TRANSCRIBED');
  const echoLog = [...logs].reverse().find((l) => l.type === 'TTS_ECHO_PLAYING');
  const answeredLog = logs.find((l) => l.type === 'PHONE_ANSWERED');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-sans animate-fade-in">
      <div className="w-full max-w-4xl bg-[#0d111a] border border-[#252f44] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Top Header */}
        <div className="px-6 py-4 bg-[#0a0d14] border-b border-[#1b2438] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#122419] border border-[#1f4a2b] flex items-center justify-center text-[#3fb950] shadow-sm">
              <PhoneCall size={18} className={callStatus === 'in-progress' || callStatus === 'ringing' ? 'animate-bounce' : ''} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#f0f6fc]">Twilio Voice STT & TTS Echo Diagnostics</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#122419] text-[#3fb950] border border-[#1f4a2b]">
                  Live Echo Drill
                </span>
              </div>
              <p className="text-[11px] text-[#8b949e]">
                Tests outbound telephony, speech-to-text recognition, and neural voice echo in real-time
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRedial}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#273855] text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-[#58a6ff]' : ''} />
              <span>Re-dial</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#161b22] hover:bg-[#21262d] text-[#8b949e] hover:text-[#f0f6fc] flex items-center justify-center transition border border-[#21262d]"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Telephony Error Alert */}
        {callError && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-[#261317] border border-[#4a1c24] text-xs text-[#ff7b72] flex items-center gap-2 flex-shrink-0">
            <AlertTriangle size={15} className="text-[#f85149] shrink-0" />
            <div className="flex-1">
              <span className="font-bold">Telephony Error: </span>
              <span>{callError}</span>
            </div>
          </div>
        )}

        {/* Telemetry Bar */}
        <div className="p-4 bg-[#080b11] border-b border-[#1b2438] grid grid-cols-1 md:grid-cols-4 gap-3 flex-shrink-0">
          <div className="p-3 rounded-xl bg-[#0d121c] border border-[#1b2438]">
            <span className="text-[10px] uppercase font-bold text-[#6e7681] block">Call Status</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border uppercase flex items-center gap-1.5 ${getStatusColor(callStatus)}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {callStatus || 'Idle'}
              </span>
              <span className="text-xs font-mono text-[#8b949e]">{formatSeconds(duration)}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#0d121c] border border-[#1b2438]">
            <span className="text-[10px] uppercase font-bold text-[#6e7681] block">Target Recipient (To)</span>
            <p className="text-xs font-mono text-[#f0f6fc] font-bold mt-1 truncate">{engineerPhone}</p>
          </div>

          <div className="p-3 rounded-xl bg-[#0d121c] border border-[#1b2438]">
            <span className="text-[10px] uppercase font-bold text-[#6e7681] block">Twilio Caller ID (From)</span>
            <p className="text-xs font-mono text-[#79c0ff] font-bold mt-1 truncate">{twilioFrom}</p>
          </div>

          <div className="p-3 rounded-xl bg-[#0d121c] border border-[#1b2438] flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-[#6e7681] block">Call SID</span>
              <p className="text-[11px] font-mono text-[#8b949e] truncate mt-1">
                {callSid || 'Dialing...'}
              </p>
            </div>
            {callSid && callStatus !== 'completed' && (
              <button
                onClick={handleHangup}
                disabled={hangingUp}
                title="End Active Call"
                className="px-2.5 py-1 rounded bg-[#261317] hover:bg-[#3d1820] text-[#ff7b72] border border-[#4a1c24] text-[10px] font-bold flex items-center gap-1 transition flex-shrink-0"
              >
                <PhoneOff size={12} />
                <span>End</span>
              </button>
            )}
          </div>
        </div>

        {/* Diagnostic Echo Live Results Banner */}
        <div className="p-4 bg-[#0a0e16] border-b border-[#1b2438] grid grid-cols-1 md:grid-cols-2 gap-3 flex-shrink-0">
          {/* Card 1: Speech-To-Text */}
          <div className={`p-3.5 rounded-xl border transition ${
            speechLog ? 'bg-[#0d1e17] border-[#1b3d2b]' : 'bg-[#090d14] border-[#161f30]'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Mic size={15} className={speechLog ? 'text-[#3fb950]' : answeredLog ? 'text-[#79c0ff] animate-pulse' : 'text-[#6e7681]'} />
                <span className="text-xs font-bold text-[#f0f6fc]">1. Speech-to-Text (STT)</span>
              </div>
              {speechLog ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#122419] text-[#3fb950] border border-[#1f4a2b] font-bold">
                  VERIFIED ({speechLog.meta?.confidence || 'High'})
                </span>
              ) : answeredLog ? (
                <span className="text-[10px] font-mono text-[#79c0ff] animate-pulse">LISTENING ON PHONE...</span>
              ) : (
                <span className="text-[10px] font-mono text-[#6e7681]">AWAITING CALL</span>
              )}
            </div>
            <p className="text-xs font-mono text-[#c9d1d9] italic bg-[#05070a]/60 p-2.5 rounded-lg border border-[#161f30] min-h-[38px] flex items-center">
              {speechLog ? `"${speechLog.meta?.speech}"` : answeredLog ? 'Speak any sentence into your phone now...' : 'Phone ringing... Pick up to begin speech drill'}
            </p>
          </div>

          {/* Card 2: Text-To-Speech Echo */}
          <div className={`p-3.5 rounded-xl border transition ${
            echoLog ? 'bg-[#0c1626] border-[#1f375b]' : 'bg-[#090d14] border-[#161f30]'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Volume2 size={15} className={echoLog ? 'text-[#79c0ff]' : 'text-[#6e7681]'} />
                <span className="text-xs font-bold text-[#f0f6fc]">2. Neural TTS Voice Echo</span>
              </div>
              {echoLog ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#161f30] text-[#79c0ff] border border-[#263550] font-bold">
                  ECHO SYNTHESIZED
                </span>
              ) : (
                <span className="text-[10px] font-mono text-[#6e7681]">PENDING STT</span>
              )}
            </div>
            <p className="text-xs font-mono text-[#c9d1d9] italic bg-[#05070a]/60 p-2.5 rounded-lg border border-[#161f30] min-h-[38px] flex items-center">
              {echoLog ? `"${echoLog.meta?.echo_text}"` : 'Twilio will speak your words right back to you on the call'}
            </p>
          </div>
        </div>

        {/* 5-Step Lifecycle Progress Tracker */}
        <div className="px-6 py-2.5 bg-[#080b11] border-b border-[#1b2438] flex items-center justify-between text-xs overflow-x-auto flex-shrink-0">
          {[
            { id: '1', title: 'Outbound Dial', active: true, done: Boolean(callSid) },
            { id: '2', title: 'Attend Call', active: Boolean(callSid), done: Boolean(answeredLog) },
            { id: '3', title: 'Speak Into Mic', active: Boolean(answeredLog), done: Boolean(speechLog) },
            { id: '4', title: 'STT Transcription', active: Boolean(speechLog), done: Boolean(speechLog) },
            { id: '5', title: 'TTS Voice Echo', active: Boolean(echoLog), done: Boolean(echoLog) },
          ].map((st, i) => (
            <div key={st.id} className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full border text-[10px] font-mono font-bold flex items-center justify-center ${
                  st.done
                    ? 'bg-[#122419] border-[#1f4a2b] text-[#3fb950]'
                    : st.active
                    ? 'bg-[#161f30] border-[#263550] text-[#79c0ff] animate-pulse'
                    : 'bg-[#161b22] border-[#21262d] text-[#6e7681]'
                }`}>
                  {st.done ? '✓' : st.id}
                </span>
                <span className={`text-[11px] font-semibold ${st.done ? 'text-[#3fb950]' : st.active ? 'text-[#f0f6fc]' : 'text-[#6e7681]'}`}>
                  {st.title}
                </span>
              </div>
              {i < 4 && <ArrowRight size={11} className="text-[#263550] mx-2" />}
            </div>
          ))}
        </div>

        {/* Live Terminal Logs Area */}
        <div className="flex-1 p-5 overflow-y-auto bg-[#05070a] font-mono space-y-2 min-h-[190px]">
          <div className="flex items-center justify-between pb-2 border-b border-[#1b2234] text-[11px] text-[#6e7681]">
            <div className="flex items-center gap-2">
              <Terminal size={13} className="text-[#3fb950]" />
              <span>LIVE TELEMETRY LOG STREAM</span>
            </div>
            <span>{logs.length} EVENTS</span>
          </div>

          {logs.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#6e7681] space-y-2">
              <Radio size={24} className="mx-auto text-[#263550] animate-pulse" />
              <p>Calling {engineerPhone} via Cloudflare Tunnel...</p>
              <p className="text-[10px]">Pick up your phone and say a test sentence when prompted.</p>
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className="text-xs leading-relaxed flex items-start gap-2.5 p-1.5 rounded hover:bg-[#0d121c] transition"
              >
                <span className="text-[#6e7681] text-[10px] flex-shrink-0 select-none pt-0.5">
                  [{log.timestamp}]
                </span>

                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase flex-shrink-0 border ${
                    log.type === 'SPEECH_TRANSCRIBED' || log.type === 'TTS_ECHO_PLAYING'
                      ? 'bg-[#122419] text-[#3fb950] border-[#1f4a2b]'
                      : log.type === 'PHONE_ANSWERED'
                      ? 'bg-[#161f30] text-[#79c0ff] border-[#263550]'
                      : log.type === 'CALL_FAILED'
                      ? 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]'
                      : 'bg-[#161b22] text-[#8b949e] border-[#21262d]'
                  }`}
                >
                  {log.type}
                </span>

                <span className="text-[#c9d1d9] flex-1 break-all">
                  {log.message}
                </span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>

        {/* Footer: Quick Speech Simulator */}
        <form
          onSubmit={handleSimulateSpeechSubmit}
          className="p-3 bg-[#0a0d14] border-t border-[#1b2438] flex items-center justify-between gap-3 flex-shrink-0"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Sparkles size={14} className="text-[#e3b341] flex-shrink-0" />
            <input
              type="text"
              placeholder="Or test STT callback directly: Type sentence to simulate speaking..."
              value={simulatedSpeech}
              onChange={(e) => setSimulatedSpeech(e.target.value)}
              className="flex-1 bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-1.5 rounded-md focus:outline-none focus:border-[#58a6ff] font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={simulatingSpeech}
            className="px-3.5 py-1.5 rounded-md bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#263550] text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 flex-shrink-0"
          >
            <Send size={12} />
            <span>Simulate Speech</span>
          </button>
        </form>

      </div>
    </div>
  );
}
