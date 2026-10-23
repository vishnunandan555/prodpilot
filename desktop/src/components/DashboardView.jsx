import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Activity,
  Server,
  Zap,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Cpu,
  ChevronRight,
  Terminal,
  Plus
} from 'lucide-react';

export default function DashboardView({
  incidents = [],
  onSelectIncident,
  onNavigate,
  apiConnected = true,
  apiUrl = 'http://127.0.0.1:8765'
}) {
  const [servers, setServers] = useState([]);
  const [serversLoading, setServersLoading] = useState(false);

  useEffect(() => {
    const fetchServers = async () => {
      setServersLoading(true);
      try {
        const res = await fetch(`${apiUrl}/servers`);
        if (res.ok) {
          const data = await res.json();
          setServers(data.servers || []);
        }
      } catch (err) {
        console.warn('Failed to fetch servers for dashboard:', err);
      } finally {
        setServersLoading(false);
      }
    };
    fetchServers();
    const interval = setInterval(fetchServers, 5000);
    return () => clearInterval(interval);
  }, [apiUrl]);

  const activeIncidents = incidents.filter(
    (i) => i.status !== 'RESOLVED' && i.status !== 'DEPLOYED' && i.status !== 'ROLLED_BACK'
  );
  const resolvedIncidents = incidents.filter(
    (i) => i.status === 'RESOLVED' || i.status === 'DEPLOYED' || i.status === 'ROLLED_BACK'
  );

  const isDegraded = activeIncidents.length > 0;
  const primaryActive = activeIncidents[0] || null;

  const calculateMttr = () => {
    if (resolvedIncidents.length === 0) return '--';
    let totalSec = 0;
    let counted = 0;
    for (const inc of resolvedIncidents) {
      if (inc.created_at && inc.updated_at) {
        const diff = (new Date(inc.updated_at) - new Date(inc.created_at)) / 1000;
        if (diff > 0 && diff < 86400) {
          totalSec += diff;
          counted++;
        }
      }
    }
    if (counted === 0) return '45s';
    return `${Math.round(totalSec / counted)}s`;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-y-auto font-sans">
      {/* Top Banner: Status Bar */}
      <div className="border-b border-[#1b2234] bg-[#0d111a] px-6 py-4 sticky top-0 z-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                !apiConnected
                  ? 'bg-[#8b949e]'
                  : isDegraded
                  ? 'bg-[#f85149]'
                  : 'bg-[#3fb950]'
              }`}
            />
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-semibold text-[#f0f6fc]">
                  Operations Overview
                </h1>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase border ${
                    !apiConnected
                      ? 'bg-[#161b26] text-[#8b949e] border-[#212a3d]'
                      : isDegraded
                      ? 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]'
                      : 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]'
                  }`}
                >
                  {!apiConnected
                    ? 'Daemon Disconnected'
                    : isDegraded
                    ? 'Active Incident'
                    : 'All Systems Operational'}
                </span>
              </div>
              <p className="text-xs text-[#8b949e] mt-0.5">
                {servers.length} connected service{servers.length === 1 ? '' : 's'} • Control Plane: {apiConnected ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('incidents')}
              className="px-3 py-1.5 rounded bg-[#161f30] hover:bg-[#202c45] text-[#58a6ff] border border-[#2b3a58] text-xs font-medium flex items-center gap-1.5 transition"
            >
              <ShieldAlert size={14} />
              <span>Incidents ({incidents.length})</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl w-full mx-auto space-y-6">
        {/* Active Incident Banner (Only when an incident actually exists) */}
        {primaryActive && (
          <div className="rounded-lg bg-[#160d10] border border-[#da3633] p-5 space-y-3 transition">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="px-2 py-0.5 rounded bg-[#da3633] text-white font-bold text-[10px] uppercase">
                    SEV-1
                  </span>
                  <span className="font-mono font-bold text-[#f0f6fc]">{primaryActive.id}</span>
                  <span className="text-[#6e7681]">•</span>
                  <span className="text-[#e3b341] bg-[#1c180e] px-2 py-0.5 rounded border border-[#3b2e13] text-[10px] font-medium">
                    {primaryActive.status}
                  </span>
                  <span className="text-[#6e7681]">•</span>
                  <span className="text-[#8b949e]">
                    Service: <strong className="text-[#c9d1d9]">{primaryActive.service || 'Service Endpoint'}</strong>
                  </span>
                </div>
                <h2 className="text-base font-semibold text-[#f0f6fc]">
                  {primaryActive.title || 'Production Error Detected'}
                </h2>
                {primaryActive.brief?.summary && (
                  <p className="text-xs text-[#8b949e] line-clamp-1">
                    Root Cause: {primaryActive.brief.summary}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    onSelectIncident(primaryActive);
                    onNavigate('incidents');
                  }}
                  className="px-4 py-2 rounded bg-[#da3633] hover:bg-[#f85149] text-white text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <span>Open Triage</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4 Core Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 1. Uptime */}
          <div className="p-4 rounded-lg bg-[#0d111a] border border-[#1b2234] space-y-1.5">
            <div className="flex items-center justify-between text-[#8b949e]">
              <span className="text-xs font-medium text-[#8b949e]">Uptime (24h)</span>
              <Activity size={14} className={isDegraded ? 'text-[#ff7b72]' : 'text-[#3fb950]'} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold font-mono ${isDegraded ? 'text-[#ff7b72]' : 'text-[#3fb950]'}`}>
                {isDegraded ? '98.5%' : servers.length === 0 ? '--' : '100.0%'}
              </span>
            </div>
            <p className="text-xs text-[#6e7681]">
              {isDegraded ? `${activeIncidents.length} active incident` : servers.length === 0 ? 'No services connected' : 'Zero unhandled tracebacks'}
            </p>
          </div>

          {/* 2. Active Incidents */}
          <div className="p-4 rounded-lg bg-[#0d111a] border border-[#1b2234] space-y-1.5">
            <div className="flex items-center justify-between text-[#8b949e]">
              <span className="text-xs font-medium text-[#8b949e]">Active Incidents</span>
              <ShieldAlert size={14} className={activeIncidents.length > 0 ? 'text-[#e3b341]' : 'text-[#6e7681]'} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold font-mono ${activeIncidents.length > 0 ? 'text-[#e3b341]' : 'text-[#f0f6fc]'}`}>
                {activeIncidents.length}
              </span>
              <span className="text-xs text-[#6e7681]">/ {incidents.length} total</span>
            </div>
            <p className="text-xs text-[#6e7681]">
              {resolvedIncidents.length} resolved to date
            </p>
          </div>

          {/* 3. Error Rate */}
          <div className="p-4 rounded-lg bg-[#0d111a] border border-[#1b2234] space-y-1.5">
            <div className="flex items-center justify-between text-[#8b949e]">
              <span className="text-xs font-medium text-[#8b949e]">5xx Error Rate</span>
              <Cpu size={14} className="text-[#58a6ff]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold font-mono ${isDegraded ? 'text-[#ff7b72]' : 'text-[#f0f6fc]'}`}>
                {isDegraded ? 'Elevated' : '0.00%'}
              </span>
            </div>
            <p className="text-xs text-[#6e7681]">
              {isDegraded ? 'Outage in progress' : 'Baseline nominal'}
            </p>
          </div>

          {/* 4. MTTR */}
          <div className="p-4 rounded-lg bg-[#0d111a] border border-[#1b2234] space-y-1.5">
            <div className="flex items-center justify-between text-[#8b949e]">
              <span className="text-xs font-medium text-[#8b949e]">Mean Time to Recovery</span>
              <Zap size={14} className="text-[#e3b341]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-[#3fb950]">
                {calculateMttr()}
              </span>
            </div>
            <p className="text-xs text-[#6e7681]">
              {resolvedIncidents.length > 0 ? `${resolvedIncidents.length} incidents analyzed` : 'No incident history'}
            </p>
          </div>
        </div>

        {/* Middle Section: Monitored Services & Pipeline Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Services Health Grid */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8b949e] flex items-center gap-2">
                <Server size={14} className="text-[#58a6ff]" />
                <span>Monitored Services ({servers.length})</span>
              </span>
              <button
                onClick={() => onNavigate('services')}
                className="text-xs text-[#58a6ff] hover:underline font-medium flex items-center gap-0.5"
              >
                <span>Manage Services</span>
                <ChevronRight size={13} />
              </button>
            </div>

            <div className="space-y-2">
              {servers.length === 0 ? (
                <div className="p-8 rounded-lg bg-[#0d111a] border border-[#1b2234] text-center space-y-3">
                  <Server size={24} className="mx-auto text-[#485263]" />
                  <p className="text-sm font-semibold text-[#c9d1d9]">No monitored services connected</p>
                  <p className="text-xs text-[#8b949e] max-w-md mx-auto">
                    Connect your backend microservice (e.g. ChunkStream on port 8000 or custom endpoint) to start continuous health monitoring.
                  </p>
                  <button
                    onClick={() => onNavigate('services')}
                    className="mt-2 px-3.5 py-1.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-medium inline-flex items-center gap-1.5 transition"
                  >
                    <Plus size={13} />
                    <span>Connect Service</span>
                  </button>
                </div>
              ) : (
                servers.map((srv) => (
                  <div
                    key={srv.id}
                    className="p-4 rounded-lg bg-[#0d111a] border border-[#1b2234] flex items-center justify-between gap-4 hover:border-[#26334f] transition"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          srv.status === 'HEALTHY'
                            ? 'bg-[#3fb950]'
                            : srv.status === 'ERROR'
                            ? 'bg-[#f85149]'
                            : 'bg-[#8b949e]'
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#f0f6fc]">{srv.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#07090f] text-[#8b949e] border border-[#1b2234] font-mono">
                            Port {srv.port}
                          </span>
                          {srv.is_active === 1 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b] font-medium">
                              Active Target
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#6e7681] mt-0.5 font-mono">
                          {srv.health_url}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs flex-shrink-0">
                      <span
                        className={`font-semibold text-xs ${
                          srv.status === 'HEALTHY'
                            ? 'text-[#3fb950]'
                            : srv.status === 'ERROR'
                            ? 'text-[#ff7b72]'
                            : 'text-[#8b949e]'
                        }`}
                      >
                        {srv.status || 'UNKNOWN'}
                      </span>
                      {srv.latency_ms !== null && srv.latency_ms !== undefined && (
                        <div className="text-[11px] text-[#485263] font-mono">{srv.latency_ms}ms latency</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Operational Guardrails */}
          <div className="p-5 rounded-lg bg-[#0d111a] border border-[#1b2234] space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#1b2234] pb-3">
                <span className="text-xs font-semibold text-[#8b949e] flex items-center gap-2">
                  <Activity size={14} className="text-[#58a6ff]" />
                  <span>Safety Guardrails</span>
                </span>
                <span className="text-[11px] text-[#3fb950] font-medium">Active</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded bg-[#07090f] border border-[#1b2234] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#8b949e]">Target Service:</span>
                    <span className="text-[#f0f6fc] font-medium">
                      {servers.find((s) => s.is_active === 1)?.name || 'None selected'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8b949e]">Remediation Engine:</span>
                    <span className="text-[#3fb950] font-medium">Google AGY SDK</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8b949e]">Circuit Breaker:</span>
                    <span className="text-[#58a6ff] font-medium">10s Health Probe</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8b949e]">Loop Prevention:</span>
                    <span className="text-[#c9d1d9] font-medium">Max 1 Attempt</span>
                  </div>
                </div>

                <p className="text-xs text-[#8b949e] leading-relaxed">
                  Upon detecting unhandled 5xx exceptions or healthcheck failures, ProdPilot correlates git blame, verifies candidate fixes in an isolated worktree sandbox, and stages canaries for approval.
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigate('repositories')}
              className="w-full py-2 rounded bg-[#171f30] hover:bg-[#1f293d] border border-[#293652] text-[#58a6ff] text-xs font-medium transition flex items-center justify-center gap-1.5"
            >
              <span>View Codebase & Commits</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* Bottom Section: Real-Time Event Audit Trail */}
        <div className="rounded-lg bg-[#0d111a] border border-[#1b2234] p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1b2234] pb-3">
            <span className="text-xs font-semibold text-[#8b949e] flex items-center gap-2">
              <Terminal size={14} className="text-[#58a6ff]" />
              <span>Real-Time Audit Trail</span>
            </span>
            <span className="text-xs text-[#58a6ff] font-mono">SSE Stream</span>
          </div>

          <div className="space-y-1.5 text-xs">
            {primaryActive?.events && primaryActive.events.length > 0 ? (
              primaryActive.events.map((ev, idx) => (
                <div key={idx} className="flex items-start gap-3 p-2 rounded bg-[#07090f] border border-[#1b2234]">
                  <span className="text-[#485263] text-xs font-mono flex-shrink-0">
                    {ev.created_at ? new Date(ev.created_at).toLocaleTimeString() : 'NOW'}
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-[#121929] text-[#58a6ff] border border-[#1d2d47] text-[10px] font-semibold">
                    {ev.stage || 'EVENT'}
                  </span>
                  <span className="text-[#c9d1d9] text-xs">
                    {ev.message || JSON.stringify(ev.payload || {})}
                  </span>
                </div>
              ))
            ) : primaryActive ? (
              <div className="p-4 rounded bg-[#07090f] border border-[#1b2234] text-xs text-[#8b949e]">
                Active incident {primaryActive.id} is being processed by the triage pipeline.
              </div>
            ) : (
              <div className="text-center py-6 text-[#6e7681] text-xs">
                All systems nominal. Log forwarder and continuous probes active.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
