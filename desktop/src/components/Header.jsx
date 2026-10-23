import React, { useState } from 'react';
import {
  ShieldAlert,
  Activity,
  RotateCcw,
  Zap,
  RefreshCw,
  Server,
  Radio,
  Flame,
  CheckCircle2
} from 'lucide-react';

export default function Header({
  apiConnected,
  apiBaseUrl,
  onRefresh,
  isRefreshing,
  activeIncidentCount,
  onTriggerCrash,
  onResetDemo
}) {
  const [triggeringCrash, setTriggeringCrash] = useState(false);
  const [resettingDemo, setResettingDemo] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const showFeedback = (msg, type = 'info') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleCrashClick = async () => {
    setTriggeringCrash(true);
    try {
      const res = await onTriggerCrash();
      showFeedback('💥 Outage triggered on demo-prod! Healthcheck 500.', 'error');
    } catch (e) {
      showFeedback(`Failed to trigger crash: ${e.message}`, 'error');
    } finally {
      setTriggeringCrash(false);
    }
  };

  const handleResetClick = async () => {
    setResettingDemo(true);
    try {
      await onResetDemo();
      showFeedback('🔄 demo-prod restored to clean HEAD on port 8000 (200 OK).', 'success');
    } catch (e) {
      showFeedback(`Failed to reset demo: ${e.message}`, 'error');
    } finally {
      setResettingDemo(false);
    }
  };

  return (
    <header className="glass-panel border-b border-white/10 px-6 py-3 flex items-center justify-between sticky top-0 z-50 bg-[#070a12]/95 backdrop-blur-md">
      {/* Brand & Subtitle */}
      <div className="flex items-center gap-4">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/25">
          <Zap className="w-5 h-5 text-white" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#070a12] animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              ProdPilot <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">STREAM-B</span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-2">
            Autonomous SRE Incident Remediation & Deterministic Verifier
          </p>
        </div>
      </div>

      {/* Center status indicators / Feedback alert */}
      <div className="hidden md:flex items-center gap-4">
        {feedback ? (
          <div className={`px-4 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all animate-bounce ${
            feedback.type === 'error'
              ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
              : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
          }`}>
            {feedback.type === 'error' ? <ShieldAlert className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            <span>{feedback.msg}</span>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 text-xs font-mono">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Engine API:</span>
              <span className="text-slate-200">{apiBaseUrl}</span>
              <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
                <span className={`w-2 h-2 rounded-full ${apiConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className={apiConnected ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                  {apiConnected ? 'Connected' : 'Offline / Standby'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 text-xs">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-400">Open Incidents:</span>
              <span className="font-semibold font-mono text-white px-1.5 py-0.2 rounded bg-indigo-500/30">
                {activeIncidentCount}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right controls: Demo triggers & Refresh */}
      <div className="flex items-center gap-3">
        {/* Quick Demo Controls */}
        <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-lg border border-white/10">
          <button
            onClick={handleCrashClick}
            disabled={triggeringCrash}
            title="Send bad order without discount key to crash demo-prod"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-all font-semibold disabled:opacity-50 shadow-sm shadow-rose-950"
          >
            <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            <span>{triggeringCrash ? 'Crashing...' : '💥 Trigger Test Crash'}</span>
          </button>

          <button
            onClick={handleResetClick}
            disabled={resettingDemo}
            title="Reset demo-prod git repo and restart service on port 8000"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition-all font-semibold disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-slate-400 ${resettingDemo ? 'animate-spin' : ''}`} />
            <span>{resettingDemo ? 'Resetting...' : '🔄 Reset Demo'}</span>
          </button>
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all disabled:opacity-50"
          title="Refresh incidents"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
        </button>
      </div>
    </header>
  );
}
