import React, { useState } from 'react';
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
  Play
} from 'lucide-react';

const STAGES = [
  { key: 'UNDERSTAND', label: '1. Understand', desc: 'Traceback & Blame Analysis' },
  { key: 'REPRODUCE', label: '2. Reproduce', desc: 'Synthesizing Minimal Repro Test' },
  { key: 'FIX', label: '3. Patch Fix', desc: 'Agent Modifies Code in Worktree' },
  { key: 'VERIFY', label: '4. Deterministic Verify', desc: 'Repro & Full Test Suite' },
  { key: 'STAGE', label: '5. Side Canaries', desc: 'Port 8001 (Fix) & 8002 (Revert)' },
  { key: 'DECIDE', label: '6. Decision Rules', desc: 'Fix-Forward vs Rollback' },
  { key: 'AWAIT_APPROVAL', label: '7. Approval Gate', desc: 'Human in the Loop' },
  { key: 'DEPLOY', label: '8. Deploy & Verify', desc: 'Swapping Port 8000' },
];

export default function Timeline({ events = [], currentStatus = 'OPEN' }) {
  const [expandedEventId, setExpandedEventId] = useState(null);

  const getStageState = (stageKey) => {
    // Find events matching this stage
    const stageEvents = events.filter((e) => e.stage === stageKey);
    if (stageEvents.length === 0) return 'PENDING';
    
    // Check if any error occurred in stage
    const hasError = stageEvents.some((e) => e.kind === 'error');
    if (hasError) return 'ERROR';

    // If there is a later stage that started, this stage is completed
    const stageIndex = STAGES.findIndex((s) => s.key === stageKey);
    const hasLaterStage = events.some((e) => {
      const idx = STAGES.findIndex((s) => s.key === e.stage);
      return idx > stageIndex;
    });

    if (hasLaterStage || currentStatus === 'DEPLOYED' || currentStatus === 'ROLLED_BACK') {
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
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Visual Pipeline Stage Stepper */}
      <div className="glass-panel p-4 overflow-x-auto">
        <div className="flex items-center justify-between min-w-[700px] gap-2">
          {STAGES.map((s, idx) => {
            const state = getStageState(s.key);
            let pillClass = 'bg-white/5 border-white/10 text-slate-500';
            let dot = <span className="w-2 h-2 rounded-full bg-slate-600" />;

            if (state === 'COMPLETED') {
              pillClass = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
              dot = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
            } else if (state === 'IN_PROGRESS') {
              pillClass = 'bg-indigo-500/20 border-indigo-500 text-indigo-200 ring-2 ring-indigo-500/30 shadow-lg shadow-indigo-500/20';
              dot = <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping" />;
            } else if (state === 'ERROR') {
              pillClass = 'bg-rose-500/20 border-rose-500 text-rose-200';
              dot = <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
            }

            return (
              <div key={s.key} className="flex-1 flex flex-col items-center text-center">
                <div className={`w-full py-2 px-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${pillClass}`}>
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
            <h3 className="text-sm font-semibold text-white">Live Event Timeline (SSE Stream)</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {events.length} event{events.length === 1 ? '' : 's'} recorded
          </span>
        </div>

        {events.length === 0 ? (
          <div className="p-8 text-center text-slate-500 font-mono text-xs space-y-2">
            <Clock className="w-6 h-6 mx-auto text-slate-600 animate-spin" />
            <p>Awaiting pipeline events from backend API...</p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-white/10">
            {events.map((evt, i) => {
              const isExpanded = expandedEventId === (evt.id || i);
              const payload = typeof evt.payload === 'string' ? JSON.parse(evt.payload || '{}') : evt.payload;

              return (
                <div key={evt.id || i} className="relative group">
                  {/* Timeline bullet */}
                  <span className="absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full bg-[#0d121f] border-2 border-indigo-500 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  </span>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getEventIcon(evt.kind)}
                        <span className="font-mono text-indigo-300 font-medium">{evt.stage}</span>
                        <span className="text-slate-400">•</span>
                        <span className="font-semibold text-slate-200">{evt.kind}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">
                        {evt.ts ? new Date(evt.ts).toLocaleTimeString() : ''}
                      </span>
                    </div>

                    {/* Summary / Message */}
                    {payload?.message && (
                      <p className="mt-1.5 text-slate-300 text-xs font-mono">{payload.message}</p>
                    )}
                    {payload?.summary && (
                      <p className="mt-1.5 text-slate-300 text-xs font-mono">{payload.summary}</p>
                    )}
                    {payload?.failure_snippet && (
                      <div className="mt-2 p-2 rounded bg-rose-950/30 border border-rose-500/20 text-rose-300 font-mono text-[11px]">
                        {payload.failure_snippet}
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
          </div>
        )}
      </div>
    </div>
  );
}
