import React from 'react';
import {
  Bot,
  Cpu,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Terminal,
  Layers,
  Clock,
  Sparkles,
  Lock,
  Flame,
  Radio,
  Workflow,
  Server
} from 'lucide-react';

export default function AgentsView() {
  const agents = [
    {
      id: 'agent-triage',
      name: 'Triage & Severity Classifier',
      tier: 'Stream A (Rule-Based)',
      status: 'IDLE',
      statusColor: 'bg-[#121929] text-[#58a6ff] border-[#1d2d47]',
      latency: '< 1ms',
      runs: 14,
      model: 'Deterministic AST / Regex',
      purpose: 'Fast rule filter for 5xx, unhandled tracebacks, and health probe failures. Tags HIGH vs LOW severity.'
    },
    {
      id: 'agent-rca',
      name: 'Investigation & Root Cause Agent',
      tier: 'Stream B (Context & Blame)',
      status: 'IDLE',
      statusColor: 'bg-[#121929] text-[#58a6ff] border-[#1d2d47]',
      latency: '1.4s',
      runs: 3,
      model: 'Google Antigravity SDK',
      purpose: 'Correlates stack trace with git blame, PR reviewer discussions, and commits. Distinguishes facts from hypotheses.'
    },
    {
      id: 'agent-fix',
      name: 'Remediation & Patch Agent',
      tier: 'Stream B (Worktree Sandbox)',
      status: 'STANDBY',
      statusColor: 'bg-[#121929] text-[#58a6ff] border-[#1d2d47]',
      latency: '4.2s',
      runs: 3,
      model: 'Google Antigravity SDK (`agy` v1.4.6) · Failover: Gemini',
      purpose: 'Isolated git worktree execution: synthesizes failing test_repro.py (Red), applies patch, verifies full suite (Green).'
    },
    {
      id: 'agent-watchdog',
      name: 'Verification Watchdog & Auto-Revert',
      tier: 'Stream B (Circuit Breaker)',
      status: 'ARMED',
      statusColor: 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]',
      latency: '10.0s Probe Window',
      runs: 2,
      model: 'Deterministic Circuit Breaker',
      purpose: 'Monitors production port 8000 for 10 seconds post-deploy. Immediately auto-reverts if error occurs. Capped at 1 try.'
    },
    {
      id: 'agent-notifier',
      name: 'Telegram & Web Notifier',
      tier: 'Stream C (Mobile Dispatch)',
      status: 'ONLINE',
      statusColor: 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]',
      latency: '240ms',
      runs: 5,
      model: 'Telegram Bot API (@prodpilotbot)',
      purpose: 'Dispatches instant mobile alerts with direct Render incident webpage links and 1-tap inline decision buttons.'
    }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-y-auto font-sans">
      {/* Matte SRE Header */}
      <div className="border-b border-[#1b2234] bg-[#0d111a] px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#171f30] border border-[#293652] flex items-center justify-center text-[#58a6ff]">
              <Bot size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-[#f0f6fc] tracking-tight">
                  Autonomous Agent Fleet
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b]">
                  5 AGENTS ARMED
                </span>
              </div>
              <p className="text-[11px] text-[#8b949e] font-mono">
                Google Antigravity SDK multi-agent orchestration & deterministic safety guardrails
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-[#171f30] border border-[#293652] text-[#58a6ff] text-xs font-mono">
              Antigravity CLI v1.4.6
            </span>
          </div>
        </div>
      </div>

      <div className="p-5 max-w-5xl w-full mx-auto space-y-4">
        {/* Safety Guardrails Banner */}
        <div className="p-4 rounded-lg bg-[#0d111a] border border-[#1b2234] space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#8b949e] flex items-center gap-2">
              <ShieldCheck size={14} className="text-[#3fb950]" />
              <span>Autonomous SRE Safety Constraints & Invariants</span>
            </h2>
            <span className="text-[10px] font-mono text-[#3fb950]">Strictly Enforced</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono pt-1">
            <div className="p-2.5 rounded bg-[#07090f] border border-[#1b2234]">
              <span className="text-[#6e7681] block text-[10px] uppercase">Human Approval Gate</span>
              <span className="text-[#f0f6fc] font-semibold block mt-0.5">Mandatory for Prod Deploy</span>
              <span className="text-[10px] text-[#8b949e] block mt-0.5">Desktop & Mobile 1-Tap</span>
            </div>
            <div className="p-2.5 rounded bg-[#07090f] border border-[#1b2234]">
              <span className="text-[#6e7681] block text-[10px] uppercase">Remediation Retry Cap</span>
              <span className="text-[#f0f6fc] font-semibold block mt-0.5">1 Attempt Max (No Loops)</span>
              <span className="text-[10px] text-[#8b949e] block mt-0.5">Circuit breaker auto-revert</span>
            </div>
            <div className="p-2.5 rounded bg-[#07090f] border border-[#1b2234]">
              <span className="text-[#6e7681] block text-[10px] uppercase">Code Execution Sandbox</span>
              <span className="text-[#f0f6fc] font-semibold block mt-0.5">Isolated Git Worktrees</span>
              <span className="text-[10px] text-[#8b949e] block mt-0.5">Canaries on :8001 / :8002</span>
            </div>
          </div>
        </div>

        {/* Agent Cards */}
        <div className="space-y-2.5">
          {agents.map((ag) => (
            <div
              key={ag.id}
              className="p-3.5 rounded-lg bg-[#0d111a] border border-[#1b2234] space-y-2.5 hover:border-[#293652] transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1b2234] pb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded bg-[#171f30] border border-[#293652] flex items-center justify-center text-[#58a6ff]">
                    <Bot size={14} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xs font-semibold text-[#f0f6fc]">{ag.name}</h2>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#171f30] text-[#c9d1d9] border border-[#293652]">
                        {ag.tier}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8b949e] font-mono mt-0.5">
                      Engine: <span className="text-[#c9d1d9]">{ag.model}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0 text-xs font-mono">
                  <div className="text-right">
                    <span className="text-[10px] text-[#6e7681] block">LATENCY</span>
                    <span className="text-xs text-[#f0f6fc] font-semibold">{ag.latency}</span>
                  </div>
                  <div className="text-right pl-2 border-l border-[#1b2234]">
                    <span className="text-[10px] text-[#6e7681] block">EXECUTIONS</span>
                    <span className="text-xs text-[#c9d1d9]">{ag.runs}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${ag.statusColor}`}>
                    {ag.status}
                  </span>
                </div>
              </div>

              <p className="text-xs text-[#8b949e] font-mono leading-relaxed">
                {ag.purpose}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
