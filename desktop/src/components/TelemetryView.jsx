import React, { useState } from 'react';
import {
  Activity,
  Terminal,
  Radio,
  Copy,
  Check,
  Trash2,
  Pause,
  Play,
  Filter,
  CheckCircle2
} from 'lucide-react';

export default function TelemetryView({
  events = [],
  incident,
  apiConnected,
  apiBaseUrl,
}) {
  const [copied, setCopied] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [levelFilter, setLevelFilter] = useState('ALL');

  const defaultLogs = incident?.log_tail || 'Waiting for live telemetry stream from connected services...';

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(defaultLogs);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gh-canvas text-gh-text overflow-hidden">
      {/* Top Header */}
      <div className="h-12 px-4 border-b border-gh-border bg-gh-surface flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Activity size={16} className="text-indigo-400" />
          <span className="font-semibold text-sm text-gh-text-bright">
            Live Telemetry & Service Logs
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live SSE Stream
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLogs}
            className="gh-btn-secondary px-2.5 py-1 text-xs flex items-center gap-1.5"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy Logs'}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left: Real-time Live SSE Event Stream */}
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-gh-border flex flex-col bg-gh-surface/40">
          <div className="p-3 border-b border-gh-border flex items-center justify-between text-xs text-gh-text-muted">
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              SSE Pipeline Events
            </span>
            <span className="font-mono">{events.length} received</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {events.length === 0 ? (
              <div className="text-xs text-gh-text-dim text-center py-8 font-mono">
                Awaiting SSE events from backend...
              </div>
            ) : (
              events.map((ev, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-gh-inset border border-gh-border text-xs font-mono space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-indigo-400 font-bold">
                      {ev.stage || 'STAGE'}
                    </span>
                    <span className="text-[10px] text-gh-text-dim">
                      {ev.kind || 'event'}
                    </span>
                  </div>
                  <div className="text-gh-text-bright text-[11px] truncate">
                    {typeof ev.payload === 'string'
                      ? ev.payload
                      : JSON.stringify(ev.payload)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Service Console Log Terminal */}
        <div className="flex-1 flex flex-col bg-gh-canvas min-w-0">
          <div className="p-3 border-b border-gh-border flex items-center justify-between text-xs bg-gh-surface/30">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-gh-text-muted" />
              <span className="font-mono text-gh-text-bright text-xs">
                demo-prod (Port 8000) Log Tail
              </span>
            </div>
            <span className="text-[11px] font-mono text-gh-text-dim">
              Engine: {apiBaseUrl}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-black/60 font-mono text-xs leading-relaxed text-slate-300 select-text">
            <pre className="whitespace-pre-wrap">{defaultLogs}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
