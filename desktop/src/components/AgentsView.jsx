import React, { useState, useEffect } from 'react';
import {
  Bot,
  Activity,
  Filter,
  GitBranch,
  Cpu,
  ShieldCheck,
  PhoneCall,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  ArrowRight,
  Lock,
  Server,
  FolderGit2,
  Radio,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';

const iconMap = {
  Activity: Activity,
  Filter: Filter,
  GitBranch: GitBranch,
  Cpu: Cpu,
  ShieldCheck: ShieldCheck,
  PhoneCall: PhoneCall,
  Bot: Bot
};

export default function AgentsView({ apiUrl = 'http://127.0.0.1:8765', incidents = [], onNavigate }) {
  const [fleetData, setFleetData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const fleetDataRef = React.useRef(null);

  const fetchAgents = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/agents`);
      if (res.ok) {
        const data = await res.json();
        if (JSON.stringify(data) !== JSON.stringify(fleetDataRef.current)) {
          fleetDataRef.current = data;
          setFleetData(data);
          setLastRefreshed(new Date());
        }
      }
    } catch (err) {
      console.error('Failed to fetch agents telemetry:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents(false);
    const interval = setInterval(() => fetchAgents(true), 20000);
    return () => clearInterval(interval);
  }, [apiUrl]);

  const agents = fleetData?.agents || [
    {
      id: 'watchdog',
      name: 'Production Telemetry & Watchdog Agent',
      type: 'Ingestion & Health Probing',
      status: 'STANDBY',
      status_detail: 'Standby — Connect a server in Production Servers tab to activate watchdog probes',
      current_target: 'No production server connected',
      last_action: 'Awaiting target server registration',
      capabilities: ['Render REST API v1', 'HTTP Health Probing', 'Crash Log Ingestion'],
      safety_guard: 'Non-intrusive probe only',
      health: 'STANDBY',
      icon: 'Activity'
    },
    {
      id: 'triage',
      name: 'Triage & Fingerprint Agent',
      type: 'Crash Normalization & Severity Scoring',
      status: 'READY',
      status_detail: 'SHA-256 stack trace fingerprinter & Jev / OpenRouter rule evaluation engine',
      current_target: 'Jev Decision Engine (System 1)',
      last_action: 'Triage rule index warm. 0 active incident alerts.',
      capabilities: ['Traceback Extraction', 'SHA-256 Deduplication', 'Severity Tagging'],
      safety_guard: 'Deterministic rule filtering',
      health: 'HEALTHY',
      icon: 'Filter'
    },
    {
      id: 'investigation',
      name: 'AST Code Investigation & Blame Agent',
      type: 'Git Blame & Syntax Tree Correlation',
      status: 'STANDBY',
      status_detail: 'Standby — Link a repository in Projects tab to enable blame correlation',
      current_target: 'No repository connected',
      last_action: 'Commit blame cache synchronized with repository HEAD',
      capabilities: ['AST Syntax Analysis', 'Git Commit Blame', 'PR Diff Correlation'],
      safety_guard: 'Read-only git inspection',
      health: 'STANDBY',
      icon: 'GitBranch'
    },
    {
      id: 'patch_sandbox',
      name: 'Patch Synthesis & Worktree Sandbox Agent',
      type: 'Autonomous Code Repair',
      status: 'READY',
      status_detail: 'Isolated Git Worktree sandbox (/worktrees). Deterministic 1-attempt anti-loop guard.',
      current_target: 'Isolated Git Worktree',
      last_action: '0 active worktrees. Worktree isolation lock free.',
      capabilities: ['Repro Test Synthesis', 'AST Code Patching', 'Pytest Suite Runner'],
      safety_guard: 'Max 1 Attempt (Anti-Loop Circuit Breaker)',
      health: 'HEALTHY',
      icon: 'Cpu'
    },
    {
      id: 'canary_verifier',
      name: 'Canary Verification & Gatekeeper Agent',
      type: 'Staging Validation & Decision Scoring',
      status: 'READY',
      status_detail: 'Ephemeral container runtime. Port pool: localhost:8001-8010. Confidence threshold: 85%.',
      current_target: 'Ephemeral Canary Port Pool',
      last_action: 'Canary runner initialized and standing by',
      capabilities: ['Zero-Downtime Staging', 'Canary Probe Runner', 'Fix vs Rollback Scorer'],
      safety_guard: 'Never routes prod traffic until operator approval',
      health: 'HEALTHY',
      icon: 'ShieldCheck'
    },
    {
      id: 'oncall_dispatcher',
      name: 'On-Call Dispatcher & Voice Escalation Agent',
      type: 'Interactive Notifications & Phone Escalation',
      status: 'ONLINE',
      status_detail: 'Telegram bot @prodpilotbot 1-tap decision buttons + Twilio voice emergency escalation tree',
      current_target: 'Telegram (@prodpilotbot) + Twilio Voice',
      last_action: 'Listening for operator approvals & Telegram polling active',
      capabilities: ['1-Tap Inline Approvals', 'Sev-1 Voice Dialing', 'Real-Time Callback SSE'],
      safety_guard: 'Strict Chat ID & Phone Whitelist',
      health: 'HEALTHY',
      icon: 'PhoneCall'
    }
  ];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ONLINE':
      case 'HEALTHY':
      case 'MONITORING':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse" />
            {status}
          </span>
        );
      case 'PROCESSING':
      case 'ANALYZING':
      case 'SYNTHESIZING':
      case 'VERIFYING':
      case 'DISPATCHING':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#121d33] text-[#58a6ff] border border-[#203a6b] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#58a6ff] animate-ping" />
            {status}
          </span>
        );
      case 'ALERTING':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#2d1217] text-[#ff7b72] border border-[#522129] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff7b72] animate-bounce" />
            {status}
          </span>
        );
      case 'READY':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#161f30] text-[#79c0ff] border border-[#293c61] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#79c0ff]" />
            {status}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#10141f] text-[#8b949e] border border-[#1f283d] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6e7681]" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-y-auto font-sans">
      {/* Top Header */}
      <div className="border-b border-[#1b2234] bg-[#0d111a] px-6 py-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#131c2e] border border-[#233554] flex items-center justify-center text-[#58a6ff] shadow-sm">
              <Bot size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-sm font-bold text-[#f0f6fc] tracking-tight">
                  Autonomous Remediation Fleet & Agent Runtime
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b] font-semibold">
                  FLEET ONLINE
                </span>
              </div>
              <p className="text-xs text-[#8b949e] mt-0.5">
                Live agent telemetry, real-time task execution, worktree sandboxes, and safety guardrails
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#6e7681] hidden md:inline">
              Sync: {lastRefreshed.toLocaleTimeString()}
            </span>
            <button
              onClick={fetchAgents}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-[#161f30] hover:bg-[#1f2d47] border border-[#27395c] text-[#f0f6fc] text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin text-[#58a6ff]' : ''} />
              <span>{loading ? 'Refreshing...' : 'Refresh Fleet'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl w-full mx-auto space-y-5">
        {/* Environment & Live Target Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-[#0d111a] border border-[#1b2234] space-y-1">
            <div className="flex items-center justify-between text-[#8b949e]">
              <span className="text-[10px] uppercase font-bold tracking-wider">Monitored Server</span>
              <Server size={13} className="text-[#58a6ff]" />
            </div>
            <div className="text-xs font-bold text-[#f0f6fc] truncate">
              {fleetData?.active_server || 'No Server Connected'}
            </div>
            <p className="text-[11px] text-[#8b949e]">
              {fleetData?.active_server ? (
                <span className="text-[#3fb950] font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />
                  Active Watchdog Probe
                </span>
              ) : (
                <button
                  onClick={() => onNavigate && onNavigate('servers')}
                  className="text-[#58a6ff] hover:underline flex items-center gap-1"
                >
                  Connect in Servers →
                </button>
              )}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d111a] border border-[#1b2234] space-y-1">
            <div className="flex items-center justify-between text-[#8b949e]">
              <span className="text-[10px] uppercase font-bold tracking-wider">Target Repository</span>
              <FolderGit2 size={13} className="text-[#d2a8ff]" />
            </div>
            <div className="text-xs font-bold text-[#f0f6fc] truncate">
              {fleetData?.active_project || 'No Project Linked'}
            </div>
            <p className="text-[11px] text-[#8b949e]">
              {fleetData?.active_project ? (
                <span className="text-[#d2a8ff] font-medium">AST & Git Blame Ready</span>
              ) : (
                <button
                  onClick={() => onNavigate && onNavigate('projects')}
                  className="text-[#58a6ff] hover:underline flex items-center gap-1"
                >
                  Link in Projects →
                </button>
              )}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d111a] border border-[#1b2234] space-y-1">
            <div className="flex items-center justify-between text-[#8b949e]">
              <span className="text-[10px] uppercase font-bold tracking-wider">Worktree Sandbox</span>
              <Cpu size={13} className="text-[#3fb950]" />
            </div>
            <div className="text-xs font-bold text-[#3fb950]">
              Isolated & Clean
            </div>
            <p className="text-[11px] text-[#8b949e]">
              Anti-Loop Guard (Max 1 Try)
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d111a] border border-[#1b2234] space-y-1">
            <div className="flex items-center justify-between text-[#8b949e]">
              <span className="text-[10px] uppercase font-bold tracking-wider">Active Incident Queue</span>
              <Radio size={13} className="text-[#e3b341]" />
            </div>
            <div className="text-xs font-bold text-[#f0f6fc]">
              {incidents.length} Active / 0 In Repair
            </div>
            <p className="text-[11px] text-[#8b949e]">
              {incidents.length === 0 ? 'All Systems Healthy' : `${incidents.length} Under Autonomous Triage`}
            </p>
          </div>
        </div>

        {/* Live Agents Roster */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#8b949e]">
              Available Autonomous Agents ({agents.length})
            </h2>
            <span className="text-[11px] text-[#6e7681]">Real-time operational states</span>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {agents.map((agent) => {
              const IconComp = iconMap[agent.icon] || Bot;
              return (
                <div
                  key={agent.id}
                  className="p-5 rounded-xl bg-[#0d111a] border border-[#1b2234] hover:border-[#273859] transition shadow-xs space-y-4"
                >
                  {/* Top Bar of Agent Card */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#171f2e] pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#141d2f] border border-[#233554] flex items-center justify-center text-[#58a6ff] shrink-0">
                        <IconComp size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-[#f0f6fc]">{agent.name}</h3>
                        </div>
                        <p className="text-xs text-[#8b949e]">{agent.type}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {getStatusBadge(agent.status)}
                    </div>
                  </div>

                  {/* Operational Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Current Active Target */}
                    <div className="p-3 rounded-lg bg-[#080b11] border border-[#182030] space-y-1">
                      <span className="text-[10px] font-semibold text-[#8b949e] uppercase tracking-wider block">
                        Assigned Target / Environment
                      </span>
                      <div className="font-mono text-xs text-[#79c0ff] truncate font-medium">
                        {agent.current_target}
                      </div>
                      <p className="text-[11px] text-[#8b949e] leading-relaxed">
                        {agent.status_detail}
                      </p>
                    </div>

                    {/* Exact Real-Time Action */}
                    <div className="p-3 rounded-lg bg-[#080b11] border border-[#182030] space-y-1">
                      <span className="text-[10px] font-semibold text-[#8b949e] uppercase tracking-wider block">
                        Real-Time Action & Telemetry
                      </span>
                      <div className="font-medium text-xs text-[#f0f6fc] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#58a6ff]" />
                        <span>{agent.last_action}</span>
                      </div>
                      <div className="text-[11px] text-[#6e7681]">
                        Safety: <span className="text-[#3fb950] font-medium">{agent.safety_guard}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tool Capabilities Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-semibold text-[#6e7681] uppercase tracking-wider mr-1">
                      Toolchain:
                    </span>
                    {agent.capabilities?.map((cap, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-[#131926] text-[#8b949e] border border-[#1e293d] text-[11px] font-mono"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
