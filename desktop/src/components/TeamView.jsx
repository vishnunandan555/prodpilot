import React from 'react';
import {
  Users,
  ShieldCheck,
  PhoneCall,
  Send,
  Bell,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Radio,
  Calendar
} from 'lucide-react';

export default function TeamView() {
  const members = [
    {
      id: 1,
      name: 'Vishnu Nandan',
      role: 'Primary On-Call SRE (Lead)',
      tier: 'Tier 1 Responder',
      status: 'ONLINE',
      statusColor: 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]',
      channel: 'Telegram (@prodpilotbot)',
      phone: '+91 (On-Call Direct)',
      tz: 'Asia/Kolkata (IST)'
    },
    {
      id: 2,
      name: 'Christ Engineering Team',
      role: 'Secondary Backup SRE',
      tier: 'Tier 2 Escalation',
      status: 'STANDBY',
      statusColor: 'bg-[#121929] text-[#58a6ff] border-[#1d2d47]',
      channel: 'Slack #prod-incidents',
      phone: '+91 (Escalation Hunt)',
      tz: 'Asia/Kolkata (IST)'
    },
    {
      id: 3,
      name: 'Autonomous Antigravity Bot',
      role: 'First-Responder AI Agent',
      tier: 'Tier 0 Auto-Mitigation',
      status: '24/7 ACTIVE',
      statusColor: 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]',
      channel: 'ProdPilot Internal RPC',
      phone: 'Autonomous API',
      tz: 'UTC'
    }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-y-auto font-sans">
      {/* Matte SRE Header */}
      <div className="border-b border-[#1b2234] bg-[#0d111a] px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#171f30] border border-[#293652] flex items-center justify-center text-[#58a6ff]">
              <Users size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-[#f0f6fc] tracking-tight">
                  On-Call Team & Escalation Policy
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b]">
                  SHIFT ACTIVE
                </span>
              </div>
              <p className="text-[11px] text-[#8b949e] font-mono">
                PagerDuty/Telegram dispatch rotation, emergency escalation matrix & timezone routing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-[#0d1e17] border border-[#1b3d2b] text-[#3fb950] text-xs font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />
              <span>Primary On-Call: Vishnu Nandan</span>
            </span>
          </div>
        </div>
      </div>

      <div className="p-5 max-w-5xl w-full mx-auto space-y-4">
        {/* Escalation Policy Matrix Card */}
        <div className="p-4 rounded-lg bg-[#0d111a] border border-[#1b2234] space-y-3">
          <div className="flex items-center justify-between border-b border-[#1b2234] pb-2.5">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#8b949e] font-semibold flex items-center gap-2">
              <Bell size={14} className="text-[#58a6ff]" />
              <span>Automated Incident Escalation Ladder</span>
            </h2>
            <span className="text-[10px] font-mono text-[#58a6ff]">Target MTTA &lt; 5s · MTTD &lt; 10s</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs font-mono">
            <div className="p-3 rounded bg-[#07090f] border border-[#1b2234] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="px-1.5 py-0.2 rounded bg-[#121929] text-[#58a6ff] font-bold border border-[#1d2d47] text-[10px]">
                  TIER 0 (0s)
                </span>
                <span className="text-[#3fb950] text-[10px]">Instant</span>
              </div>
              <h3 className="font-semibold text-[#f0f6fc]">Autonomous Investigation</h3>
              <p className="text-[#8b949e] text-[11px] leading-relaxed">
                AST filter classifies crash $\rightarrow$ Antigravity agent crafts repro test & staging canary on port 8001.
              </p>
            </div>

            <div className="p-3 rounded bg-[#07090f] border border-[#1b2234] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="px-1.5 py-0.2 rounded bg-[#2b200d] text-[#e3b341] font-bold border border-[#543e11] text-[10px]">
                  TIER 1 (&lt; 10s)
                </span>
                <span className="text-[#e3b341] text-[10px]">Telegram Push</span>
              </div>
              <h3 className="font-semibold text-[#f0f6fc]">Telegram Mobile Alert</h3>
              <p className="text-[#8b949e] text-[11px] leading-relaxed">
                Dispatches alert card with direct Render webpage link & inline 1-tap Approve Deploy button.
              </p>
            </div>

            <div className="p-3 rounded bg-[#07090f] border border-[#1b2234] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="px-1.5 py-0.2 rounded bg-[#261317] text-[#ff7b72] font-bold border border-[#4a1c24] text-[10px]">
                  TIER 2 (5 mins)
                </span>
                <span className="text-[#ff7b72] text-[10px]">Escalate</span>
              </div>
              <h3 className="font-semibold text-[#f0f6fc]">Team Pager & Rollback</h3>
              <p className="text-[#8b949e] text-[11px] leading-relaxed">
                If unacknowledged within 5 minutes, triggers secondary SRE notification and circuit breaker.
              </p>
            </div>
          </div>
        </div>

        {/* Team Members List */}
        <div className="space-y-2.5">
          {members.map((m) => (
            <div
              key={m.id}
              className="p-3.5 rounded-lg bg-[#0d111a] border border-[#1b2234] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#293652] transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-[#171f30] border border-[#293652] flex items-center justify-center text-[#f0f6fc] text-xs font-bold font-mono flex-shrink-0">
                  {m.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-semibold text-[#f0f6fc]">{m.name}</h2>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#171f30] text-[#c9d1d9] border border-[#293652]">
                      {m.tier}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8b949e] font-mono mt-0.5">
                    {m.role} • {m.tz}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0 text-xs font-mono">
                <div className="text-right">
                  <span className="text-[#c9d1d9] block">{m.channel}</span>
                  <span className="text-[10px] text-[#6e7681]">{m.phone}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${m.statusColor}`}>
                  {m.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
