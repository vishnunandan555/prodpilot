import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  PhoneOff,
  Loader2,
  Volume2,
  Mic,
  Activity,
  CheckCircle2,
  Radio,
} from 'lucide-react';

export default function VoiceHotlineButton({
  onClick,
  apiUrl = 'http://127.0.0.1:8765',
  incidentId = null,
  className = '',
}) {
  const [callData, setCallData] = useState({
    step: 'IDLE',
    step_label: 'Voice Hotline',
    is_active: false,
    duration: 0,
    status: 'idle',
    call_sid: null,
  });

  // Local duration counter to tick smoothly every second during an active call
  useEffect(() => {
    if (!callData.is_active || callData.step === 'IDLE' || callData.step === 'LAUNCHING' || callData.step === 'RINGING' || callData.step === 'ENDED') {
      return;
    }
    const timer = setInterval(() => {
      setCallData((prev) => ({
        ...prev,
        duration: (prev.duration || 0) + 1,
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, [callData.is_active, callData.step]);

  // Poll backend voice active status
  useEffect(() => {
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const query = incidentId ? `?incident_id=${encodeURIComponent(incidentId)}` : '';
        const res = await fetch(`${apiUrl}/voice/active-call${query}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          const isActive = Boolean(data.is_active && data.step !== 'IDLE' && data.step !== 'ENDED');
          setCallData((prev) => ({
            ...prev,
            ...data,
            is_active: isActive,
            // Reset to 0 when call is inactive/ended/idle; only track duration when genuinely in-progress
            duration: isActive ? Math.max(data.duration || 0, prev.duration || 0) : 0,
          }));
        }
      } catch (err) {
        // Soft fail on polling error, maintain last state
      }
    };

    fetchStatus();
    // Poll faster (1.2s) when call is in progress/ringing, slightly slower (3s) when idle
    const pollInterval = callData.is_active ? 1200 : 3000;
    const interval = setInterval(fetchStatus, pollInterval);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiUrl, incidentId, callData.is_active]);

  const formatDuration = (sec = 0) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Render icon & visual styles according to current Twilio step
  const getStepConfig = () => {
    const step = (callData.step || 'IDLE').toUpperCase();

    switch (step) {
      case 'LAUNCHING':
        return {
          icon: <Loader2 size={11} className="text-[#79c0ff] animate-spin shrink-0" />,
          label: callData.step_label || 'Launching Call...',
          style: 'bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border-[#263550] shadow-[0_0_10px_rgba(88,166,255,0.2)] animate-pulse',
          dot: 'bg-[#58a6ff]',
        };
      case 'RINGING':
      case 'DIALING':
        return {
          icon: <PhoneCall size={11} className="text-[#d29922] animate-bounce shrink-0" />,
          label: callData.step_label || 'Ringing Phone...',
          style: 'bg-[#241a12] hover:bg-[#382618] text-[#d29922] border-[#442c16] shadow-[0_0_12px_rgba(210,153,34,0.3)]',
          dot: 'bg-[#d29922] animate-ping',
        };
      case 'ANSWERED':
        return {
          icon: <PhoneCall size={11} className="text-[#3fb950] shrink-0" />,
          label: callData.step_label || 'Call Answered',
          style: 'bg-[#122419] hover:bg-[#1a3824] text-[#3fb950] border-[#1f4a2b] shadow-[0_0_12px_rgba(63,185,80,0.3)]',
          dot: 'bg-[#3fb950]',
        };
      case 'AI_SPEAKING':
        return {
          icon: <Volume2 size={11} className="text-[#58a6ff] animate-pulse shrink-0" />,
          label: callData.step_label || 'AI Speaking...',
          style: 'bg-[#0f2231] hover:bg-[#153147] text-[#58a6ff] border-[#1d4460] shadow-[0_0_14px_rgba(88,166,255,0.35)]',
          dot: 'bg-[#58a6ff] animate-ping',
        };
      case 'LISTENING':
        return {
          icon: <Mic size={11} className="text-[#e879f9] animate-pulse shrink-0" />,
          label: callData.step_label || 'Listening...',
          style: 'bg-[#241328] hover:bg-[#381c3e] text-[#e879f9] border-[#4c2354] shadow-[0_0_14px_rgba(232,121,249,0.35)]',
          dot: 'bg-[#e879f9] animate-ping',
        };
      case 'USER_SPEAKING':
        return {
          icon: <Activity size={11} className="text-[#3fb950] shrink-0 animate-pulse" />,
          label: callData.step_label || 'You Speaking...',
          style: 'bg-[#122419] hover:bg-[#1a3824] text-[#3fb950] border-[#238636] shadow-[0_0_14px_rgba(63,185,80,0.4)]',
          dot: 'bg-[#3fb950]',
        };
      case 'CALL_ACTIVE':
        return {
          icon: <PhoneCall size={11} className="text-[#3fb950] shrink-0" />,
          label: `Call Active (${formatDuration(callData.duration)})`,
          style: 'bg-[#122419] hover:bg-[#1a3824] text-[#3fb950] border-[#1f4a2b] shadow-[0_0_10px_rgba(63,185,80,0.25)]',
          dot: 'bg-[#3fb950] animate-pulse',
        };
      case 'ACTION_EXECUTED':
        return {
          icon: <CheckCircle2 size={11} className="text-[#56d364] shrink-0" />,
          label: callData.step_label || 'Action Executed!',
          style: 'bg-[#122419] hover:bg-[#1a3824] text-[#56d364] border-[#2ea043] shadow-[0_0_14px_rgba(86,211,100,0.4)]',
          dot: 'bg-[#56d364]',
        };
      case 'ENDED':
        return {
          icon: <PhoneOff size={11} className="text-[#8b949e] shrink-0" />,
          label: callData.step_label || 'Call Ended',
          style: 'bg-[#161b22] hover:bg-[#21262d] text-[#8b949e] border-[#30363d]',
          dot: null,
        };
      case 'IDLE':
      default:
        return {
          icon: <PhoneCall size={11} className="text-[#c084fc] shrink-0" />,
          label: 'Voice Hotline',
          style: 'bg-[#1e1628] hover:bg-[#2c1d3e] text-[#c084fc] border-[#3b2752]',
          dot: null,
        };
    }
  };

  const config = getStepConfig();

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1.5 transition-all duration-200 cursor-pointer select-none group ${config.style} ${className}`}
      title={`Twilio SRE Hotline: ${config.label} — Click to open live telephony console`}
    >
      {/* Live status dot when active */}
      {config.dot && (
        <span className="relative flex h-1.5 w-1.5">
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dot}`} />
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${config.dot.split(' ')[0]}`} />
        </span>
      )}

      {config.icon}

      <span className="truncate max-w-[170px] tracking-tight">{config.label}</span>
    </button>
  );
}
