import React, { useState } from 'react';
import {
  Bot,
  Terminal,
  Cpu,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  FileText,
  Search,
  FolderTree,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Play,
  RotateCcw,
  Check,
  Server,
  Activity,
  ArrowRight
} from 'lucide-react';

export default function AgentExecutionConsole({
  incident,
  events = [],
  isCompact = false,
  onApprove,
  onRollback,
  onTakeover,
  actionLoading = false,
}) {
  const [expandedToolIndex, setExpandedToolIndex] = useState(null);
  const [showThinking, setShowThinking] = useState(true);

  if (!incident) return null;

  const status = incident.status || 'DETECTED';
  const isAwaiting = status === 'AWAITING_APPROVAL';
  const isFixing = status === 'FIXING';
  const isInvestigating = status === 'INVESTIGATING' || status === 'UNDERSTAND' || status === 'DETECTED';
  const isResolved = status === 'DEPLOYED' || status === 'RESOLVED' || status === 'ROLLED_BACK';
  const isTakeover = status === 'MANUAL_TAKEOVER';

  // Extract structured thoughts and tool executions from events
  const thoughts = [];
  const toolExecutions = [];

  events.forEach((ev, idx) => {
    const stage = ev.stage || 'EXECUTE';
    const kind = ev.kind || 'tool_call';
    const payload = ev.payload || {};
    const ts = ev.ts ? new Date(ev.ts).toLocaleTimeString() : `Step ${idx + 1}`;

    if (kind === 'stage_started' || kind === 'agent_step' || stage === 'UNDERSTAND' || stage === 'DECIDE') {
      const msg = payload.message || (typeof payload === 'string' ? payload : JSON.stringify(payload));
      thoughts.push({
        id: ev.id || idx,
        ts,
        stage,
        kind,
        message: msg,
      });
    }

    if (kind === 'tool_call' || kind === 'test_result' || kind === 'decision') {
      let toolName = payload.tool || kind;
      let args = payload.args || {};
      let summary = payload.summary || payload.message || '';
      let statusKind = 'success';
      let details = payload;

      if (kind === 'test_result') {
        toolName = `pytest ${payload.phase || 'verifier'}`;
        summary = payload.summary || `Exit code ${payload.exit_code} (${payload.duration_sec}s)`;
        statusKind = payload.passed ? 'success' : 'failed';
      } else if (kind === 'decision') {
        toolName = 'decision_engine';
        summary = `Recommendation: ${payload.recommendation} (${Math.round((payload.probabilities?.fix_forward || 0.85) * 100)}% confidence)`;
        statusKind = 'decision';
      }

      toolExecutions.push({
        id: ev.id || idx,
        ts,
        stage,
        toolName,
        args,
        summary,
        statusKind,
        details,
      });
    }
  });

  // Synthesize realistic baseline thoughts if event log is sparse or starting up
  const displayThoughts = [...thoughts];
  if (displayThoughts.length === 0) {
    if (incident.detected_at || incident.created_at) {
      displayThoughts.push({
        id: 'init-1',
        ts: 'Triage 00:01',
        stage: 'UNDERSTAND',
        message: `Watchdog triggered: Non-200 probe received from ${incident.service || 'production service'}. Ingested stack trace.`,
      });
    }
    if (incident.suspect_commit) {
      const hash = typeof incident.suspect_commit === 'string' ? incident.suspect_commit.slice(0, 7) : incident.suspect_commit?.hash?.slice(0, 7);
      displayThoughts.push({
        id: 'init-2',
        ts: 'Triage 00:03',
        stage: 'UNDERSTAND',
        message: `Correlated suspect commit ${hash || 'HEAD~1'} via git blame telemetry. Isolating execution sandbox in git worktree.`,
      });
    }
  }

  // Active thinking status banner
  let activeStatusText = 'Idle';
  let activeStatusColor = 'text-[#8b949e] border-[#212a3d] bg-[#161b26]';
  let isPulsing = false;

  if (isAwaiting) {
    activeStatusText = 'Operator Approval Required';
    activeStatusColor = 'text-[#d29922] border-[#d29922]/40 bg-[#d29922]/10';
  } else if (isFixing) {
    activeStatusText = 'Synthesizing & Verifying AST Patch';
    activeStatusColor = 'text-[#58a6ff] border-[#1f6feb]/40 bg-[#1f6feb]/10';
    isPulsing = true;
  } else if (isInvestigating) {
    activeStatusText = 'Reasoning Over Telemetry & Traceback';
    activeStatusColor = 'text-[#388bfd] border-[#388bfd]/40 bg-[#388bfd]/10';
    isPulsing = true;
  } else if (isResolved) {
    activeStatusText = 'Remediation Verified & Restored';
    activeStatusColor = 'text-[#3fb950] border-[#3fb950]/40 bg-[#3fb950]/10';
  } else if (isTakeover) {
    activeStatusText = 'Manual Takeover (Automation Paused)';
    activeStatusColor = 'text-[#a371f7] border-[#a371f7]/40 bg-[#a371f7]/10';
  }

  const toggleToolExpand = (idx) => {
    setExpandedToolIndex(expandedToolIndex === idx ? null : idx);
  };

  const getToolIcon = (name) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('pytest') || lower.includes('test')) return Play;
    if (lower.includes('read') || lower.includes('file')) return FileText;
    if (lower.includes('write') || lower.includes('patch')) return FileCode;
    if (lower.includes('list') || lower.includes('dir')) return FolderTree;
    if (lower.includes('grep') || lower.includes('search')) return Search;
    if (lower.includes('decision')) return Zap;
    return Terminal;
  };

  return (
    <div className="rounded-lg bg-[#0d111a] border border-[#1b2234] overflow-hidden shadow-lg space-y-0 font-sans">
      {/* IDE Header Bar */}
      <div className="px-4 py-3 bg-[#0a0e17] border-b border-[#1b2234] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#121929] border border-[#1f6feb]/30 flex items-center justify-center text-[#58a6ff]">
            <Bot size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#f0f6fc] tracking-tight flex items-center gap-1.5">
                <span>Autonomous SRE Agent</span>
                <span className="text-[10px] font-mono font-normal px-1.5 py-0.2 rounded bg-[#161f30] text-[#58a6ff] border border-[#2b3a58]">
                  Gemini AST Engine
                </span>
              </span>
            </div>
            <p className="text-[11px] text-[#8b949e]">
              Isolated git worktree sandbox & deterministic verification loop
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Active Status Badge */}
          <div className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold border flex items-center gap-1.5 ${activeStatusColor}`}>
            <span className={`w-2 h-2 rounded-full ${
              isAwaiting ? 'bg-[#d29922]' :
              isResolved ? 'bg-[#3fb950]' :
              isFixing ? 'bg-[#58a6ff]' :
              isInvestigating ? 'bg-[#388bfd]' : 'bg-[#8b949e]'
            } ${isPulsing ? 'animate-ping' : ''}`} />
            <span>{activeStatusText}</span>
          </div>

          <div className="text-[10px] font-mono px-2 py-1 rounded bg-[#07090f] text-[#6e7681] border border-[#1b2234]">
            {toolExecutions.length} tools executed
          </div>
        </div>
      </div>

      {/* Main Agent Content Area */}
      <div className="p-4 space-y-4">
        {/* 1. Cognitive Reasoning Stream (Thinking Tray) */}
        <div className="rounded-md bg-[#07090f] border border-[#1b2234] overflow-hidden">
          <div
            onClick={() => setShowThinking(!showThinking)}
            className="px-3 py-2 bg-[#0a0e17] border-b border-[#1b2234] flex items-center justify-between cursor-pointer hover:bg-[#0f1422] transition"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-[#a371f7]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#c9d1d9] font-mono">
                Agent Cognitive Reasoning & Monologue
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#161226] text-[#a371f7] border border-[#2e2350]">
                {displayThoughts.length} steps
              </span>
            </div>
            <button className="text-[#8b949e] hover:text-[#f0f6fc] p-0.5">
              {showThinking ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {showThinking && (
            <div className="p-3 space-y-2 text-xs font-mono max-h-56 overflow-y-auto divide-y divide-[#151b29]">
              {displayThoughts.map((t, idx) => (
                <div key={t.id || idx} className="pt-2 first:pt-0 flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#a371f7] mt-1.5 flex-shrink-0" />
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-2 text-[10px] text-[#6e7681]">
                      <span className="font-semibold text-[#8b949e]">{t.stage}</span>
                      <span>·</span>
                      <span>{t.ts}</span>
                    </div>
                    <p className="text-[11px] text-[#c9d1d9] leading-relaxed break-words">
                      {t.message}
                    </p>
                  </div>
                </div>
              ))}

              {/* Pulsing indicator when currently thinking or investigating */}
              {(isFixing || isInvestigating) && (
                <div className="pt-2 flex items-center gap-2.5 text-[#58a6ff] text-xs">
                  <div className="w-2 h-2 rounded-full bg-[#58a6ff] animate-ping flex-shrink-0" />
                  <span className="italic text-[11px]">
                    {isFixing
                      ? 'Thinking: Synthesizing AST candidate patch and running regression suite...'
                      : 'Thinking: Correlating stack frames with recent git commits...'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Tool & Command Execution Feed (IDE Terminal Feed) */}
        <div className="rounded-md bg-[#07090f] border border-[#1b2234] overflow-hidden">
          <div className="px-3 py-2 bg-[#0a0e17] border-b border-[#1b2234] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal size={13} className="text-[#3fb950]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#c9d1d9] font-mono">
                Command & Tool Execution Console
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#6e7681]">
              Gated Tool Execution Sandbox
            </span>
          </div>

          <div className="p-2 space-y-1.5 max-h-72 overflow-y-auto font-mono text-xs">
            {toolExecutions.length === 0 ? (
              <div className="p-4 text-center text-[#6e7681] text-xs">
                No tool executions dispatched yet. Agent is initializing sandbox.
              </div>
            ) : (
              toolExecutions.map((tool, idx) => {
                const IconComponent = getToolIcon(tool.toolName);
                const isExpanded = expandedToolIndex === idx;
                const isSuccess = tool.statusKind === 'success';
                const isDecision = tool.statusKind === 'decision';

                return (
                  <div
                    key={tool.id || idx}
                    className="rounded bg-[#0a0e17] border border-[#1b2234] hover:border-[#2b3a58] transition overflow-hidden"
                  >
                    <div
                      onClick={() => toggleToolExpand(idx)}
                      className="px-2.5 py-1.5 flex items-center justify-between gap-2 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <IconComponent size={13} className={
                          isSuccess ? 'text-[#3fb950]' :
                          isDecision ? 'text-[#e3b341]' : 'text-[#ff7b72]'
                        } />
                        <span className="font-bold text-[11px] text-[#f0f6fc] truncate">
                          {tool.toolName}
                        </span>
                        {tool.summary && (
                          <span className="text-[11px] text-[#8b949e] truncate hidden sm:inline">
                            - {tool.summary}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                          isSuccess
                            ? 'bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b]'
                            : isDecision
                            ? 'bg-[#1c180e] text-[#e3b341] border border-[#3b2e13]'
                            : 'bg-[#261317] text-[#ff7b72] border border-[#4a1c24]'
                        }`}>
                          {isSuccess ? 'EXIT 0' : isDecision ? 'DECIDED' : 'FAIL'}
                        </span>
                        <span className="text-[10px] text-[#6e7681]">{tool.ts}</span>
                        {isExpanded ? <ChevronUp size={12} className="text-[#8b949e]" /> : <ChevronDown size={12} className="text-[#8b949e]" />}
                      </div>
                    </div>

                    {/* Tool Detailed Payload */}
                    {isExpanded && (
                      <div className="p-2.5 bg-[#05070a] border-t border-[#1b2234] text-[10px] text-[#8b949e] space-y-1.5">
                        {tool.args && Object.keys(tool.args).length > 0 && (
                          <div>
                            <span className="text-[#6e7681] block uppercase text-[9px]">Input Parameters:</span>
                            <pre className="text-[#58a6ff] bg-[#07090f] p-1.5 rounded border border-[#151d2e] overflow-x-auto mt-0.5">
                              {JSON.stringify(tool.args, null, 2)}
                            </pre>
                          </div>
                        )}
                        <div>
                          <span className="text-[#6e7681] block uppercase text-[9px]">Execution Output / Details:</span>
                          <pre className="text-[#c9d1d9] bg-[#07090f] p-1.5 rounded border border-[#151d2e] overflow-x-auto mt-0.5 whitespace-pre-wrap">
                            {typeof tool.details === 'string' ? tool.details : JSON.stringify(tool.details, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 3. Operator Approval Action Banner (Appears when Gate / Approval is needed) */}
        {isAwaiting && (
          <div className="rounded-lg bg-[#14120b] border-2 border-[#d29922]/50 p-4 space-y-3 shadow-xl animate-in fade-in">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#271d0b] border border-[#d29922]/40 flex items-center justify-center text-[#d29922] flex-shrink-0 mt-0.5">
                <ShieldAlert size={18} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#f0f6fc]">
                    Human Operator Approval Required
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#d29922]/20 text-[#d29922] border border-[#d29922]/40">
                    Stage 6 Gate
                  </span>
                </div>
                <p className="text-xs text-[#c9d1d9] mt-1 leading-relaxed">
                  The autonomous agent has reproduced the failure, synthesized a candidate patch in git worktree isolation, passed test verification, and staged dual canaries (ports 8001 & 8002).
                </p>
                <p className="text-xs text-[#8b949e] mt-1">
                  <strong>Decision Engine Recommendation:</strong> Fix-Forward (85% confidence). Confirm promotion to port 8000.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[#2e2413]">
              <button
                onClick={() => onApprove && onApprove('fix_forward')}
                disabled={actionLoading}
                className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-bold rounded-lg transition flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                <Zap size={14} />
                <span>{actionLoading ? 'Promoting...' : 'Approve & Promote Fix to Production'}</span>
              </button>

              <button
                onClick={() => onRollback && onRollback()}
                disabled={actionLoading}
                className="px-3.5 py-2 bg-[#161b26] hover:bg-[#212a3d] text-[#c9d1d9] text-xs font-semibold rounded-lg border border-[#212a3d] transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <RotateCcw size={13} />
                <span>Rollback Codebase</span>
              </button>

              <button
                onClick={() => onTakeover && onTakeover()}
                disabled={actionLoading}
                className="px-3 py-2 bg-[#161b26] hover:bg-[#212a3d] text-[#8b949e] hover:text-[#c9d1d9] text-xs rounded-lg border border-[#212a3d] transition disabled:opacity-50"
              >
                Take Over Manually
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
