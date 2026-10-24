import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Wrench,
  Terminal,
  Cpu,
  ChevronDown,
  ChevronRight,
  Radio,
  Play,
  Layers,
  Sparkles,
  Zap
} from 'lucide-react';
import { formatTime } from '../utils/formatters';

const STAGES = [
  { key: 'UNDERSTAND', label: '1. Ingestion', desc: 'Traceback & Blame' },
  { key: 'REPRODUCE', label: '2. Reproduction', desc: 'Repro Test Sandbox' },
  { key: 'FIX', label: '3. Patch Fix', desc: 'Defensive Code Mod' },
  { key: 'VERIFY', label: '4. Verification', desc: 'Regression Suite Pass' },
  { key: 'STAGE', label: '5. Canary Staging', desc: 'Ports 8001 & 8002' },
  { key: 'DECIDE', label: '6. Policy Decision', desc: 'Canary & Commit Scoring' },
  { key: 'AWAITING_APPROVAL', label: '7. Approval Gate', desc: 'Operator Sign-off' },
  { key: 'DEPLOY', label: '8. Restoration', desc: 'Deploy to Target' },
  { key: 'RESOLVED', label: '9. Restored', desc: 'Verified 200 OK' },
];

export default function Timeline({ events = [], currentStatus = 'OPEN' }) {
  const [expandedEventId, setExpandedEventId] = useState(null);
  const eventsEndRef = useRef(null);

  // Auto-scroll when new events arrive
  useEffect(() => {
    if (eventsEndRef.current) {
      eventsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events.length]);

  const normalizeStageKey = (key) => {
    if (!key) return '';
    const upper = key.toUpperCase();
    if (upper === 'AWAIT_APPROVAL') return 'AWAITING_APPROVAL';
    if (upper === 'DEPLOYED') return 'RESOLVED';
    return upper;
  };

  const getStageState = (stageKey) => {
    const normKey = normalizeStageKey(stageKey);
    const stageEvents = events.filter((e) => normalizeStageKey(e.stage) === normKey);

    // If overall status is DEPLOYED or ROLLED_BACK, mark stages completed
    if (currentStatus === 'DEPLOYED' || currentStatus === 'RESOLVED') {
      return 'COMPLETED';
    }

    if (stageEvents.length === 0) {
      // Check if later stage has occurred
      const stageIndex = STAGES.findIndex((s) => s.key === normKey);
      const hasLaterStage = events.some((e) => {
        const idx = STAGES.findIndex((s) => s.key === normalizeStageKey(e.stage));
        return idx > stageIndex;
      });
      return hasLaterStage ? 'COMPLETED' : 'PENDING';
    }

    const hasError = stageEvents.some((e) => e.kind === 'error');
    if (hasError) return 'ERROR';

    const stageIndex = STAGES.findIndex((s) => s.key === normKey);
    const hasLaterStage = events.some((e) => {
      const idx = STAGES.findIndex((s) => s.key === normalizeStageKey(e.stage));
      return idx > stageIndex;
    });

    if (hasLaterStage) {
      return 'COMPLETED';
    }
    return 'IN_PROGRESS';
  };

  const getEventIcon = (kind) => {
    switch (kind) {
      case 'tool_call':
        return <Wrench className="w-3.5 h-3.5 text-indigo-400" />;
      case 'test_result':
        return <Terminal className="w-3.5 h-3.5 text-emerald-400" />;
      case 'decision':
        return <Cpu className="w-3.5 h-3.5 text-purple-400" />;
      case 'stage_started':
        return <Play className="w-3.5 h-3.5 text-sky-400" />;
      case 'deployed':
        return <Zap className="w-3.5 h-3.5 text-emerald-400" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Visual Pipeline Stage Stepper with dynamic animations */}
      <div className="glass-panel p-4 overflow-x-auto">
        <div className="flex items-center justify-between min-w-[800px] gap-2">
          {STAGES.map((s) => {
            const state = getStageState(s.key);
            let pillClass = 'bg-white/5 border-white/10 text-slate-500';
            let dot = <span className="w-2 h-2 rounded-full bg-slate-600" />;

            if (state === 'COMPLETED') {
              pillClass = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-semibold shadow-sm shadow-emerald-500/10';
              dot = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
            } else if (state === 'IN_PROGRESS') {
              pillClass = 'bg-indigo-500/25 border-indigo-400 text-indigo-200 ring-2 ring-indigo-500/40 shadow-lg shadow-indigo-500/30 animate-pulse';
              dot = (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                </span>
              );
            } else if (state === 'ERROR') {
              pillClass = 'bg-rose-500/20 border-rose-500 text-rose-200';
              dot = <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
            }

            return (
              <div key={s.key} className="flex-1 flex flex-col items-center text-center">
                <div className={`w-full py-2 px-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-300 ${pillClass}`}>
                  {dot}
                  <span className="truncate">{s.label}</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 truncate max-w-[90px]">{s.desc}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Real-time Event Stream */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <h3 className="text-sm font-semibold text-white">Live Investigation & Pipeline Events</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              {events.length} event{events.length === 1 ? '' : 's'} streamed
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="SSE Stream Active" />
          </div>
        </div>

        {events.length === 0 ? (
          <div className="p-8 text-center text-slate-500 font-mono text-xs space-y-2">
            <Clock className="w-6 h-6 mx-auto text-slate-600 animate-spin" />
            <p>Awaiting pipeline events from backend API...</p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-3.5 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-white/10 max-h-[500px] overflow-y-auto pr-2">
            {events.map((evt, i) => {
              const isExpanded = expandedEventId === (evt.id || i);
              const payload = typeof evt.payload === 'string' ? JSON.parse(evt.payload || '{}') : evt.payload;

              return (
                <div key={evt.id || i} className="relative group transition-all">
                  {/* Timeline bullet */}
                  <span className="absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full bg-[#0d121f] border-2 border-indigo-500 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  </span>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/20 transition-all text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getEventIcon(evt.kind)}
                        <span className="font-mono text-indigo-300 font-semibold">{evt.stage}</span>
                        <span className="text-slate-500">•</span>
                        <span className="font-semibold text-slate-200">{evt.kind}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">
                        {formatTime(evt.ts)}
                      </span>
                    </div>

                    {/* Summary / Message / Details */}
                    {payload?.message && (
                      <p className="mt-1.5 text-slate-300 text-xs font-mono">{payload.message}</p>
                    )}
                    {payload?.summary && (
                      <p className="mt-1.5 text-slate-300 text-xs font-mono">{payload.summary}</p>
                    )}
                    {payload?.action && (
                      <div className="mt-1.5 flex items-center gap-2 text-xs font-mono text-emerald-400">
                        <span>Action: {payload.action.toUpperCase()}</span>
                        {payload.source && <span className="text-slate-500">• via {payload.source}</span>}
                      </div>
                    )}
                    {payload?.failure_snippet && (
                      <div className="mt-2 p-2.5 rounded bg-rose-950/40 border border-rose-500/20 text-rose-300 font-mono text-[11px]">
                        {payload.failure_snippet}
                      </div>
                    )}
                    {payload?.choice && (
                      <div className="mt-2 p-2 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-mono text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Deployed {payload.choice} onto production port {payload.production_port || 8000}</span>
                      </div>
                    )}

                    {/* Expand payload inspector */}
                    <button
                      onClick={() => setExpandedEventId(isExpanded ? null : (evt.id || i))}
                      className="mt-2 text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono"
                    >
                      {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span>{isExpanded ? 'Hide Payload' : 'Inspect JSON Payload'}</span>
                    </button>

                    {isExpanded && (
                      <pre className="mt-2 p-2.5 rounded bg-black/60 border border-white/10 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48">
                        {JSON.stringify(payload, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={eventsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
