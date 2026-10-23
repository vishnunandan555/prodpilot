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
  Plus,
  FolderGit2,
  ShieldCheck,
  Check,
  ExternalLink,
  X,
  RefreshCw,
  User,
  GitBranch,
  Radio
} from 'lucide-react';
import { StatCardsSkeleton, ListItemSkeleton } from './LoadingSkeleton';

export default function DashboardView({
  incidents = [],
  onSelectIncident,
  onNavigate,
  apiConnected = true,
  apiUrl = 'http://127.0.0.1:8765',
  currentUser
}) {
  const [servers, setServers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [services, setServices] = useState([]);

  const fetchTopology = async () => {
    setLoading(true);
    try {
      const [srvRes, projRes, svcRes] = await Promise.all([
        fetch(`${apiUrl}/servers`),
        fetch(`${apiUrl}/projects`),
        fetch(`${apiUrl}/platform-services`).catch(() => null)
      ]);
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        setServers(srvData.servers || []);
      }
      if (projRes.ok) {
        const projData = await projRes.json();
        setProjects(projData.projects || []);
        setActiveProject(projData.active_project || null);
      }
      if (svcRes && svcRes.ok) {
        const svcData = await svcRes.json();
        setServices(svcData.services || []);
      }
    } catch (err) {
      console.warn('Dashboard topology fetch error:', err);
    } finally {
      setLoading(false);
      setInitialLoaded(true);
    }
  };

  useEffect(() => {
    fetchTopology();
    const interval = setInterval(fetchTopology, 5000);
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
    if (counted === 0) return '--';
    return `${Math.round(totalSec / counted)}s`;
  };

  const hasProjects = projects.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-y-auto font-sans">
      {/* Top Banner: User's Dashboard Header */}
      <div className="border-b border-[#1b2234] bg-[#0d111a] px-6 py-4 sticky top-0 z-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                !apiConnected
                  ? 'bg-[#8b949e]'
                  : !hasProjects
                  ? 'bg-[#58a6ff]'
                  : isDegraded
                  ? 'bg-[#f85149]'
                  : servers.length === 0
                  ? 'bg-[#d29922]'
                  : 'bg-[#3fb950]'
              }`}
            />
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-semibold text-[#f0f6fc]">
                  {currentUser?.username ? `${currentUser.username}'s Dashboard` : 'My Dashboard'}
                </h1>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase border ${
                    !apiConnected
                      ? 'bg-[#161b26] text-[#8b949e] border-[#212a3d]'
                      : !hasProjects
                      ? 'bg-[#161f30] text-[#79c0ff] border-[#263550]'
                      : isDegraded
                      ? 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]'
                      : servers.length === 0
                      ? 'bg-[#241a12] text-[#d29922] border-[#442c16]'
                      : 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]'
                  }`}
                >
                  {!apiConnected
                    ? 'Daemon Disconnected'
                    : !hasProjects
                    ? 'No Projects Added'
                    : isDegraded
                    ? 'Active Incident'
                    : servers.length === 0
                    ? 'Awaiting Server'
                    : 'All Systems Operational'}
                </span>
              </div>
              <p className="text-xs text-[#8b949e] mt-0.5">
                {hasProjects
                  ? `${projects.length} project${projects.length === 1 ? '' : 's'} • ${servers.length} server${servers.length === 1 ? '' : 's'} • Control Plane: ${apiConnected ? 'Online' : 'Offline'}`
                  : `0 connected projects • Control Plane: ${apiConnected ? 'Online' : 'Offline'}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchTopology}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#121824] hover:bg-[#1a2334] text-[#c9d1d9] hover:text-[#f0f6fc] border border-[#222f47] text-xs font-medium transition"
              title="Refresh Dashboard Data"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-[#58a6ff]' : 'text-[#8b949e]'} />
              <span>Refresh</span>
            </button>

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

      {/* Main Body */}
      <div className="p-6 max-w-6xl w-full mx-auto space-y-6">
        {!initialLoaded && loading ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-xs text-[#58a6ff] pb-1">
              <RefreshCw size={13} className="animate-spin" />
              <span>Loading telemetry and dashboard topology...</span>
            </div>
            <StatCardsSkeleton />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ListItemSkeleton count={3} />
            </div>
          </div>
        ) : !hasProjects ? (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Welcome & Connect Hero */}
            <div className="p-8 rounded-2xl bg-gradient-to-b from-[#0e1422] to-[#0a0e17] border border-[#1b253b] shadow-xl text-center relative overflow-hidden">
              <div className="w-16 h-16 rounded-2xl bg-[#162238] border border-[#263756] flex items-center justify-center text-[#58a6ff] mx-auto mb-4 shadow-lg">
                <FolderGit2 size={32} />
              </div>

              <h2 className="text-xl font-bold text-[#f0f6fc] mb-2">
                Welcome to your ProdPilot Dashboard
              </h2>
              <p className="text-xs text-[#8b949e] max-w-xl mx-auto leading-relaxed mb-6">
                Your autonomous reliability control plane is ready. Because you haven't added any projects yet, your operational metrics and telemetry are waiting. Add a project to start live issue tracking, GitHub Actions deployment monitoring, and autonomous RCA.
              </p>

              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  onClick={() => onNavigate('projects')}
                  className="px-5 py-2.5 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold flex items-center gap-2 shadow-md transition"
                >
                  <Plus size={15} />
                  <span>Add Your First Project</span>
                </button>

                <button
                  onClick={() => onNavigate('servers')}
                  className="px-4 py-2.5 rounded-lg bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#273855] text-xs font-medium flex items-center gap-2 transition"
                >
                  <Server size={14} />
                  <span>Connect Production Server</span>
                </button>
              </div>
            </div>

            {/* 3 Step Setup Guide Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Step 1: Projects */}
              <div className="p-5 rounded-xl bg-[#0d111a] border border-[#1b2234] flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#161f30] text-[#79c0ff] border border-[#263550] uppercase font-bold">
                      Step 1 • Required
                    </span>
                    <FolderGit2 size={16} className="text-[#58a6ff]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#f0f6fc]">Connect GitHub Project</h3>
                  <p className="text-xs text-[#8b949e] leading-relaxed">
                    Provide a GitHub repo and optional Personal Access Token (PAT). ProdPilot clones the repository to give access to active issues, pull requests, and workflow runs.
                  </p>
                </div>

                <button
                  onClick={() => onNavigate('projects')}
                  className="w-full py-2 rounded-lg bg-[#161f30] hover:bg-[#202e47] text-[#58a6ff] hover:text-[#79c0ff] border border-[#263756] text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <span>Go to Projects</span>
                  <ChevronRight size={13} />
                </button>
              </div>

              {/* Step 2: Servers */}
              <div className="p-5 rounded-xl bg-[#0d111a] border border-[#1b2234] flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#161f30] text-[#79c0ff] border border-[#263550] uppercase font-bold">
                      Step 2 • Telemetry
                    </span>
                    <Server size={16} className="text-[#58a6ff]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#f0f6fc]">Connect Production Server</h3>
                  <p className="text-xs text-[#8b949e] leading-relaxed">
                    Add your Render Web Service ID and API key, or specify a live healthcheck URL to receive real-time 5xx logs and uptime probe alerts.
                  </p>
                </div>

                <button
                  onClick={() => onNavigate('servers')}
                  className="w-full py-2 rounded-lg bg-[#161f30] hover:bg-[#202e47] text-[#58a6ff] hover:text-[#79c0ff] border border-[#263756] text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <span>Go to Servers</span>
                  <ChevronRight size={13} />
                </button>
              </div>

              {/* Step 3: Platform Engines */}
              <div className="p-5 rounded-xl bg-[#0d111a] border border-[#1b2234] flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b] uppercase font-bold">
                      Ready • Standing By
                    </span>
                    <Cpu size={16} className="text-[#3fb950]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#f0f6fc]">Autonomous Platform Core</h3>
                  <p className="text-xs text-[#8b949e] leading-relaxed">
                    Jev System-1 Triage, Google Gemini AST code analyzer, and Telegram On-Call Dispatcher are online and standing by to monitor your projects.
                  </p>
                </div>

                <button
                  onClick={() => onNavigate('services')}
                  className="w-full py-2 rounded-lg bg-[#161f30] hover:bg-[#202e47] text-[#58a6ff] hover:text-[#79c0ff] border border-[#263756] text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <span>View Services Status</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* Platform Core Services Strip */}
            <div className="p-4 rounded-xl bg-[#0d111a] border border-[#1b2234]">
              <div className="flex items-center justify-between mb-3 border-b border-[#1b2234] pb-2">
                <span className="text-xs font-semibold text-[#8b949e] flex items-center gap-2">
                  <Radio size={14} className="text-[#3fb950]" />
                  <span>Platform Engine Availability</span>
                </span>
                <span className="text-[11px] text-[#3fb950] font-mono">Control Plane Ready</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-[#07090f] border border-[#1b2234]">
                  <div className="flex items-center justify-between text-[#8b949e] mb-1">
                    <span className="font-medium text-[#f0f6fc]">Jev Engine</span>
                    <span className="text-[10px] text-[#3fb950] font-mono font-bold">ONLINE</span>
                  </div>
                  <p className="text-[11px] text-[#6e7681]">TypeSafe Decision Model</p>
                </div>

                <div className="p-3 rounded-lg bg-[#07090f] border border-[#1b2234]">
                  <div className="flex items-center justify-between text-[#8b949e] mb-1">
                    <span className="font-medium text-[#f0f6fc]">Antigravity SDK</span>
                    <span className="text-[10px] text-[#3fb950] font-mono font-bold">ONLINE</span>
                  </div>
                  <p className="text-[11px] text-[#6e7681]">Gemini AST Code Synthesis</p>
                </div>

                <div className="p-3 rounded-lg bg-[#07090f] border border-[#1b2234]">
                  <div className="flex items-center justify-between text-[#8b949e] mb-1">
                    <span className="font-medium text-[#f0f6fc]">Telegram Bot</span>
                    <span className="text-[10px] text-[#3fb950] font-mono font-bold">ONLINE</span>
                  </div>
                  <p className="text-[11px] text-[#6e7681]">On-Call 1-Tap Approvals</p>
                </div>

                <div className="p-3 rounded-lg bg-[#07090f] border border-[#1b2234]">
                  <div className="flex items-center justify-between text-[#8b949e] mb-1">
                    <span className="font-medium text-[#f0f6fc]">Twilio Voice</span>
                    <span className="text-[10px] text-[#79c0ff] font-mono font-bold">STANDBY</span>
                  </div>
                  <p className="text-[11px] text-[#6e7681]">Sev-1 Phone Escalation Tree</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* CASE B: USER HAS CONNECTED PROJECTS */
          <div className="space-y-6">
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
                  <Activity size={14} className={isDegraded ? 'text-[#ff7b72]' : servers.length > 0 ? 'text-[#3fb950]' : 'text-[#6e7681]'} />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold font-mono ${isDegraded ? 'text-[#ff7b72]' : servers.length > 0 ? 'text-[#3fb950]' : 'text-[#8b949e]'}`}>
                    {servers.length === 0 ? '--' : isDegraded ? '98.5%' : '100.0%'}
                  </span>
                </div>
                <p className="text-xs text-[#6e7681]">
                  {servers.length === 0 ? 'No servers monitored' : isDegraded ? `${activeIncidents.length} active incident` : 'All probes nominal'}
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
                  <span className={`text-2xl font-bold font-mono ${isDegraded ? 'text-[#ff7b72]' : servers.length > 0 ? 'text-[#f0f6fc]' : 'text-[#8b949e]'}`}>
                    {servers.length === 0 ? '--' : isDegraded ? 'Elevated' : '0.00%'}
                  </span>
                </div>
                <p className="text-xs text-[#6e7681]">
                  {servers.length === 0 ? 'No servers monitored' : isDegraded ? 'Outage in progress' : 'Baseline nominal'}
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

            {/* Middle Section: Monitored Services & Operational Guardrails */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Production Servers */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#8b949e] flex items-center gap-2">
                    <Server size={14} className="text-[#58a6ff]" />
                    <span>Production Servers ({servers.length})</span>
                  </span>
                  <button
                    onClick={() => onNavigate('servers')}
                    className="text-xs text-[#58a6ff] hover:underline font-medium flex items-center gap-0.5"
                  >
                    <span>Manage Servers</span>
                    <ChevronRight size={13} />
                  </button>
                </div>

                <div className="space-y-2">
                  {servers.length === 0 ? (
                    <div className="p-8 rounded-lg bg-[#0d111a] border border-[#1b2234] text-center space-y-3">
                      <Server size={24} className="mx-auto text-[#485263]" />
                      <p className="text-sm font-semibold text-[#c9d1d9]">No production servers registered</p>
                      <p className="text-xs text-[#8b949e] max-w-md mx-auto">
                        Connect your Render Web Service or production endpoint to start continuous health monitoring and deployment tracking.
                      </p>
                      <button
                        onClick={() => onNavigate('servers')}
                        className="mt-2 px-3.5 py-1.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-medium inline-flex items-center gap-1.5 transition"
                      >
                        <Plus size={13} />
                        <span>Connect Render Server</span>
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
                        <span className="text-[#8b949e]">Active Project:</span>
                        <span className="text-[#f0f6fc] font-medium">
                          {activeProject?.name || projects[0]?.name || 'None selected'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#8b949e]">Target Service:</span>
                        <span className="text-[#f0f6fc] font-medium">
                          {servers.find((s) => s.is_active === 1)?.name || (servers[0]?.name || 'None selected')}
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
                  onClick={() => onNavigate('projects')}
                  className="w-full py-2 rounded bg-[#171f30] hover:bg-[#1f293d] border border-[#293652] text-[#58a6ff] text-xs font-medium transition flex items-center justify-center gap-1.5"
                >
                  <span>View Projects & GitHub Data</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* Real-Time Event Audit Trail */}
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
        )}
      </div>
    </div>
  );
}
