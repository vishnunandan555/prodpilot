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
import { formatIncidentId, formatStatusLabel, getStatusBadgeStyle, isIncidentActive, isIncidentInactive } from '../utils/formatters';

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

  const serversRef = React.useRef([]);
  const projectsRef = React.useRef([]);
  const servicesRef = React.useRef([]);

  const fetchTopology = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [srvRes, projRes, svcRes] = await Promise.all([
        fetch(`${apiUrl}/servers`),
        fetch(`${apiUrl}/projects`),
        fetch(`${apiUrl}/platform-services`).catch(() => null)
      ]);
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        const nextServers = srvData.servers || [];
        if (JSON.stringify(nextServers) !== JSON.stringify(serversRef.current)) {
          serversRef.current = nextServers;
          setServers(nextServers);
        }
      }
      if (projRes.ok) {
        const projData = await projRes.json();
        const nextProjects = projData.projects || [];
        if (JSON.stringify(nextProjects) !== JSON.stringify(projectsRef.current)) {
          projectsRef.current = nextProjects;
          setProjects(nextProjects);
          setActiveProject(projData.active_project || null);
        }
      }
      if (svcRes && svcRes.ok) {
        const svcData = await svcRes.json();
        const nextServices = svcData.services || [];
        if (JSON.stringify(nextServices) !== JSON.stringify(servicesRef.current)) {
          servicesRef.current = nextServices;
          setServices(nextServices);
        }
      }
    } catch (err) {
      console.warn('Dashboard topology fetch error:', err);
    } finally {
      if (!silent) setLoading(false);
      setInitialLoaded(true);
    }
  };

  useEffect(() => {
    fetchTopology(false);
    const interval = setInterval(() => fetchTopology(true), 20000);
    return () => clearInterval(interval);
  }, [apiUrl]);

  const activeIncidents = incidents.filter((i) => isIncidentActive(i.status));
  const resolvedIncidents = incidents.filter((i) => isIncidentInactive(i.status));

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

  const hasServerErrors = servers.some((s) => s.status === 'ERROR' || s.status === 'OFFLINE');
  const serverErrorCount = servers.filter((s) => s.status === 'ERROR' || s.status === 'OFFLINE').length;
  const hasSleepingServers = servers.some((s) => s.status === 'SLEEPING');
  const sleepingCount = servers.filter((s) => s.status === 'SLEEPING').length;

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
                  : isDegraded || hasServerErrors
                  ? 'bg-[#f85149]'
                  : hasSleepingServers
                  ? 'bg-[#d2a8ff]'
                  : !hasProjects
                  ? 'bg-[#58a6ff]'
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
                      : isDegraded || hasServerErrors
                      ? 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]'
                      : hasSleepingServers
                      ? 'bg-[#241a2e] text-[#d2a8ff] border-[#492b6a]'
                      : !hasProjects
                      ? 'bg-[#161f30] text-[#79c0ff] border-[#263550]'
                      : servers.length === 0
                      ? 'bg-[#241a12] text-[#d29922] border-[#442c16]'
                      : 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]'
                  }`}
                >
                  {!apiConnected
                    ? 'Disconnected'
                    : isDegraded
                    ? 'Active Incident'
                    : hasServerErrors
                    ? `Offline / Degraded (${serverErrorCount})`
                    : hasSleepingServers
                    ? `Sleeping (${sleepingCount} Idle)`
                    : !hasProjects
                    ? 'No Projects Added'
                    : servers.length === 0
                    ? 'No servers'
                    : 'All Systems Operational'}
                </span>
              </div>
              <p className="text-xs text-[#8b949e] mt-0.5">
                {hasProjects
                  ? `${projects.length} project${projects.length === 1 ? '' : 's'} • ${servers.length} server${servers.length === 1 ? '' : 's'} • ${apiConnected ? 'Online' : 'Offline'}`
                  : `0 connected projects • ${apiConnected ? 'Online' : 'Offline'}`}
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
      <div className="p-6 sm:p-8 max-w-[1680px] w-full mx-auto space-y-6">
        {!initialLoaded && loading ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-xs text-[#58a6ff] pb-1">
              <RefreshCw size={13} className="animate-spin" />
              <span>Loading...</span>
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
                Get started
              </h2>
              <p className="text-xs text-[#8b949e] max-w-xl mx-auto leading-relaxed mb-6">
                No projects yet. Add one to start monitoring incidents, deployments, and server health.
              </p>

              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  onClick={() => onNavigate('projects')}
                  className="px-5 py-2.5 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold flex items-center gap-2 shadow-md transition"
                >
                  <Plus size={15} />
                  <span>Add Project</span>
                </button>

                <button
                  onClick={() => onNavigate('servers')}
                  className="px-4 py-2.5 rounded-lg bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#273855] text-xs font-medium flex items-center gap-2 transition"
                >
                  <Server size={14} />
                  <span>Add Server</span>
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
                      Step 1
                    </span>
                    <FolderGit2 size={16} className="text-[#58a6ff]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#f0f6fc]">Connect GitHub Project</h3>
                  <p className="text-xs text-[#8b949e] leading-relaxed">
                    Connect a GitHub repo to monitor issues, PRs, and Actions.
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
                      Step 2
                    </span>
                    <Server size={16} className="text-[#58a6ff]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#f0f6fc]">Connect Production Server</h3>
                  <p className="text-xs text-[#8b949e] leading-relaxed">
                    Add a Render service or health URL for crash alerts and uptime monitoring.
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

              {/* Step 3: Platform Diagnostics */}
              <div className="p-5 rounded-xl bg-[#0d111a] border border-[#1b2234] flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b] uppercase font-bold">
                      Ready
                    </span>
                    <Cpu size={16} className="text-[#3fb950]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#f0f6fc]">Platform Automation & Diagnostics</h3>
                  <p className="text-xs text-[#8b949e] leading-relaxed">
                    Automation is ready. Connect a project and server to begin.
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
                  <span>Services</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {services.length > 0 ? (
                  services.slice(0, 4).map((svc) => (
                    <div key={svc.id} className="p-3 rounded-lg bg-[#07090f] border border-[#1b2234]">
                      <div className="flex items-center justify-between text-[#8b949e] mb-1">
                        <span className="font-medium text-[#f0f6fc] truncate">{svc.name}</span>
                        <span
                          className={`text-[10px] font-mono font-bold ${
                            svc.status === 'ONLINE'
                              ? 'text-[#3fb950]'
                              : svc.status === 'STANDBY'
                              ? 'text-[#79c0ff]'
                              : svc.status === 'OFFLINE'
                              ? 'text-[#f85149]'
                              : 'text-[#d29922]'
                          }`}
                        >
                          {svc.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6e7681] truncate">{svc.activity || svc.description}</p>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="p-3 rounded-lg bg-[#07090f] border border-[#1b2234]">
                      <div className="flex items-center justify-between text-[#8b949e] mb-1">
                        <span className="font-medium text-[#f0f6fc]">Triage Engine</span>
                        <span className="text-[10px] text-[#79c0ff] font-mono font-bold">STANDBY</span>
                      </div>
                      <p className="text-[11px] text-[#6e7681]">Triage model</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#07090f] border border-[#1b2234]">
                      <div className="flex items-center justify-between text-[#8b949e] mb-1">
                        <span className="font-medium text-[#f0f6fc]">Code Sandbox</span>
                        <span className="text-[10px] text-[#79c0ff] font-mono font-bold">STANDBY</span>
                      </div>
                      <p className="text-[11px] text-[#6e7681]">Code analysis</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#07090f] border border-[#1b2234]">
                      <div className="flex items-center justify-between text-[#8b949e] mb-1">
                        <span className="font-medium text-[#f0f6fc]">Telegram On-Call</span>
                        <span className="text-[10px] text-[#8b949e] font-mono font-bold">UNCONFIGURED</span>
                      </div>
                      <p className="text-[11px] text-[#6e7681]">Mobile alerts</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#07090f] border border-[#1b2234]">
                      <div className="flex items-center justify-between text-[#8b949e] mb-1">
                        <span className="font-medium text-[#f0f6fc]">Voice Escalation</span>
                        <span className="text-[10px] text-[#8b949e] font-mono font-bold">UNCONFIGURED</span>
                      </div>
                      <p className="text-[11px] text-[#6e7681]">Voice escalation</p>
                    </div>
                  </>
                )}
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
                      <span className="font-mono font-bold text-[#58a6ff] px-1.5 py-0.5 rounded bg-[#161f30] border border-[#263550]">
                        {formatIncidentId(primaryActive.id)}
                      </span>
                      <span className="font-mono text-xs text-[#8b949e] hidden sm:inline">{primaryActive.id}</span>
                      <span className="text-[#6e7681]">•</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusBadgeStyle(primaryActive.status)}`}>
                        {formatStatusLabel(primaryActive.status)}
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
                      className="px-4 py-2 rounded bg-[#da3633] hover:bg-[#f85149] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                    >
                      <span>Review Incident</span>
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
                    <span>Servers ({servers.length})</span>
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
                      <p className="text-sm font-semibold text-[#c9d1d9]">No servers</p>
                      <p className="text-xs text-[#8b949e] max-w-md mx-auto">
                        Add a server to monitor uptime and deployments.
                      </p>
                      <button
                        onClick={() => onNavigate('servers')}
                        className="mt-2 px-3.5 py-1.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-medium inline-flex items-center gap-1.5 transition"
                      >
                        <Plus size={13} />
                        <span>Add Server</span>
                      </button>
                    </div>
                  ) : (
                    servers.map((srv) => {
                      const sStatus = (srv.status || 'UNKNOWN').toUpperCase();
                      const isHealthy = sStatus === 'HEALTHY' || sStatus === 'LIVE';
                      const isSleeping = sStatus === 'SLEEPING';
                      const isOffline = sStatus === 'OFFLINE';

                      return (
                        <div
                          key={srv.id}
                          className="p-4 rounded-lg bg-[#0d111a] border border-[#1b2234] flex items-center justify-between gap-4 hover:border-[#26334f] transition"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${
                                isHealthy
                                  ? 'bg-[#3fb950]'
                                  : isSleeping
                                  ? 'bg-[#d2a8ff] animate-pulse'
                                  : isOffline || sStatus === 'ERROR'
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
                              className={`font-semibold text-xs flex items-center justify-end gap-1 ${
                                isHealthy
                                  ? 'text-[#3fb950]'
                                  : isSleeping
                                  ? 'text-[#d2a8ff]'
                                  : isOffline || sStatus === 'ERROR'
                                  ? 'text-[#ff7b72]'
                                  : 'text-[#8b949e]'
                              }`}
                            >
                              {isSleeping ? '💤 SLEEPING' : isHealthy ? '🟢 ONLINE' : isOffline ? '🔴 OFFLINE' : srv.status || 'UNKNOWN'}
                            </span>
                            {isSleeping ? (
                              <div className="text-[11px] text-[#8b949e] font-mono">Idle spin-down</div>
                            ) : srv.latency_ms !== null && srv.latency_ms !== undefined ? (
                              <div className="text-[11px] text-[#485263] font-mono">{srv.latency_ms}ms latency</div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
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
                        <span className="text-[#8b949e]">Deployment Target:</span>
                        <span className="text-[#e3b341] font-medium">Local Demo Process</span>
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
                  </div>
                </div>

                <button
                  onClick={() => onNavigate('projects')}
                  className="w-full py-2 rounded bg-[#171f30] hover:bg-[#1f293d] border border-[#293652] text-[#58a6ff] text-xs font-medium transition flex items-center justify-center gap-1.5"
                >
                  <span>View Projects</span>
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
                    Processing...
                  </div>
                ) : (
                  <div className="text-center py-6 text-[#6e7681] text-xs">
                    No active incidents.
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
