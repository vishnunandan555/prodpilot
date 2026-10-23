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

export default function AgentsView({ incidents = [] }) {
  const totalIncidents = incidents.length;
  const resolvedIncidents = incidents.filter(
    (i) => i.status === 'RESOLVED' || i.status === 'DEPLOYED' || i.status === 'ROLLED_BACK'
  ).length;

  const agents = [
    {
      id: 'agent-triage',
      name: 'Triage & Severity Classifier',
      tier: 'Stream A (Rule-Based)',
      status: totalIncidents > 0 ? 'ACTIVE' : 'READY',
      statusColor: totalIncidents > 0 ? 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]' : 'bg-[#121929] text-[#58a6ff] border-[#1d2d47]',
      latency: '< 1ms',
      runs: totalIncidents,
      model: 'Deterministic AST / Regex',
      purpose: 'Fast rule filter for 5xx, unhandled tracebacks, and health probe failures. Tags HIGH vs LOW severity.'
    },
    {
      id: 'agent-rca',
      name: 'Investigation & Root Cause Agent',
      tier: 'Stream B (Context & Blame)',
      status: totalIncidents > 0 ? 'ACTIVE' : 'READY',
      statusColor: totalIncidents > 0 ? 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]' : 'bg-[#121929] text-[#58a6ff] border-[#1d2d47]',
      latency: '~1.4s',
      runs: totalIncidents,
      model: 'Google Antigravity SDK',
      purpose: 'Correlates stack trace with git blame, PR reviewer discussions, and commits. Distinguishes facts from hypotheses.'
    },
    {
      id: 'agent-fix',
      name: 'Remediation & Patch Agent',
      tier: 'Stream B (Worktree Sandbox)',
      status: resolvedIncidents > 0 ? 'ACTIVE' : 'READY',
      statusColor: resolvedIncidents > 0 ? 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]' : 'bg-[#121929] text-[#58a6ff] border-[#1d2d47]',
      latency: '~4.2s',
      runs: resolvedIncidents,
      model: 'Google Antigravity SDK (`agy`)',
      purpose: 'Isolated git worktree execution: synthesizes failing test_repro.py (Red), applies patch, verifies full suite (Green).'
    },
    {
      id: 'agent-watchdog',
      name: 'Verification Watchdog & Auto-Revert',
      tier: 'Stream B (Circuit Breaker)',
      status: 'ARMED',
      statusColor: 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]',
      latency: '10.0s Probe Window',
      runs: resolvedIncidents,
      model: 'Deterministic Circuit Breaker',
      purpose: 'Monitors production port for 10 seconds post-deploy. Immediately auto-reverts if error occurs. Capped at 1 try.'
    },
    {
      id: 'agent-notifier',
      name: 'Telegram & Web Notifier',
      tier: 'Stream C (Mobile Dispatch)',
      status: 'ONLINE',
      statusColor: 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]',
      latency: '< 300ms',
      runs: totalIncidents,
      model: 'Telegram Bot API (@prodpilotbot)',
      purpose: 'Dispatches instant mobile alerts with direct Render incident webpage links and 1-tap inline decision buttons.'
    }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-y-auto font-sans">
      {/* Header */}
      <div className="border-b border-[#1b2234] bg-[#0d111a] px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#171f30] border border-[#293652] flex items-center justify-center text-[#58a6ff]">
              <Bot size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-[#f0f6fc] tracking-tight">
                  Remediation Agents & Guardrails
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b] font-medium">
                  {agents.length} READY
                </span>
              </div>
              <p className="text-xs text-[#8b949e] mt-0.5">
                Multi-agent triage, worktree isolation, deterministic safety guardrails, and watchdog circuit breakers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-[#0d1e17] border border-[#1b3d2b] text-[#3fb950] text-xs font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />
              <span>Engine Active</span>
            </span>
          </div>
        </div>
      </div>

      <div className="p-5 max-w-5xl w-full mx-auto space-y-4">
        {/* Architecture Specs Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-lg bg-[#0d111a] border border-[#1b2234] space-y-1">
            <span className="text-[10px] uppercase font-semibold text-[#6e7681] tracking-wider">Engine Core</span>
            <div className="text-xs font-semibold text-[#f0f6fc]">Google Antigravity</div>
            <p className="text-xs text-[#8b949e]">Autonomous Orchestration</p>
          </div>
          <div className="p-3.5 rounded-lg bg-[#0d111a] border border-[#1b2234] space-y-1">
            <span className="text-[10px] uppercase font-semibold text-[#6e7681] tracking-wider">Sandbox Mode</span>
            <div className="text-xs font-semibold text-[#3fb950]">Git Worktrees</div>
            <p className="text-xs text-[#8b949e]">Isolated Working Dir</p>
          </div>
          <div className="p-3.5 rounded-lg bg-[#0d111a] border border-[#1b2234] space-y-1">
            <span className="text-[10px] uppercase font-semibold text-[#6e7681] tracking-wider">Safety Guard</span>
            <div className="text-xs font-semibold text-[#58a6ff]">Max 1 Attempt</div>
            <p className="text-xs text-[#8b949e]">Anti-Loop Defense</p>
          </div>
          <div className="p-3.5 rounded-lg bg-[#0d111a] border border-[#1b2234] space-y-1">
            <span className="text-[10px] uppercase font-semibold text-[#6e7681] tracking-wider">Incident Load</span>
            <div className="text-xs font-semibold text-[#e3b341]">{totalIncidents} Total</div>
            <p className="text-xs text-[#8b949e]">{resolvedIncidents} Resolved</p>
          </div>
        </div>

        {/* Agents Card List */}
        <div className="space-y-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="p-4 rounded-lg bg-[#0d111a] border border-[#1b2234] hover:border-[#293652] transition space-y-2.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1b2234] pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-[#171f30] border border-[#293652] flex items-center justify-center text-[#58a6ff]">
                    <Bot size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold text-[#f0f6fc]">{agent.name}</h3>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-medium ${agent.statusColor}`}>
                        {agent.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#8b949e] mt-0.5">
                      {agent.tier} • Engine: <span className="text-[#c9d1d9]">{agent.model}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-right flex-shrink-0">
                  <div>
                    <span className="text-[#6e7681] text-[10px] block font-semibold uppercase">LATENCY</span>
                    <span className="text-[#58a6ff] font-mono">{agent.latency}</span>
                  </div>
                  <div>
                    <span className="text-[#6e7681] text-[10px] block font-semibold uppercase">RUN COUNT</span>
                    <span className="text-[#f0f6fc] font-semibold">{agent.runs} runs</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-[#8b949e] leading-relaxed">
                {agent.purpose}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
