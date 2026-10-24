import React, { useState, useEffect } from 'react';
import {
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Plus,
  Trash2,
  Clock,
  RefreshCw,
  Zap,
  Globe,
  Radio,
  Layers,
  ShieldAlert,
  ArrowUpRight,
  Terminal,
  FolderGit2,
  Sparkles,
  PhoneCall,
  Send,
  Bot,
  ShieldCheck,
  Power,
  Check,
  Moon,
  WifiOff
} from 'lucide-react';
import { ListItemSkeleton } from './LoadingSkeleton';
import { formatDate, formatRelativeTime } from '../utils/formatters';

const SERVICE_ICONS_MAP = {
  telegram: Send,
  twilio: PhoneCall,
  render_watchdog: Activity,
  antigravity: Bot,
  auto_revert: ShieldCheck,
  tunnel: Globe,
  jev: Zap,
};

export default function ServersView({ apiUrl, onNavigateToLogs }) {
  const [servers, setServers] = useState([]);
  const [activeServer, setActiveServer] = useState(null);
  const [selectedServerId, setSelectedServerId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [probingId, setProbingId] = useState(null);
  const [wakingId, setWakingId] = useState(null);
  const [renderDetails, setRenderDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [discoveredServices, setDiscoveredServices] = useState([]);
  const [discovering, setDiscovering] = useState(false);
  const [registerProgress, setRegisterProgress] = useState(null);

  // Platform Services Toggle Controls
  const [platformServices, setPlatformServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [confirmToggleTarget, setConfirmToggleTarget] = useState(null);
  const [togglingServiceId, setTogglingServiceId] = useState(null);

  const fetchPlatformServices = async () => {
    setServicesLoading(true);
    try {
      const res = await fetch(`${apiUrl}/platform-services`);
      if (res.ok) {
        const data = await res.json();
        setPlatformServices(data.services || []);
      }
    } catch (e) {
      console.warn('Failed to load platform services:', e);
    } finally {
      setServicesLoading(false);
    }
  };

  useEffect(() => {
    fetchPlatformServices();
  }, [apiUrl]);

  const handleExecuteToggle = async () => {
    if (!confirmToggleTarget) return;
    const { service, nextState } = confirmToggleTarget;
    setTogglingServiceId(service.id);
    try {
      const res = await fetch(`${apiUrl}/platform-services/${service.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState }),
      });
      if (res.ok) {
        setPlatformServices((prev) =>
          prev.map((s) =>
            s.id === service.id
              ? {
                  ...s,
                  enabled: nextState,
                  status: nextState ? (s.configured ? 'ONLINE' : 'STANDBY') : 'MUTED',
                }
              : s
          )
        );
        fetchPlatformServices();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to update service: ${errData.detail || 'Server error'}`);
      }
    } catch (err) {
      alert(`Error toggling service: ${err.message}`);
    } finally {
      setTogglingServiceId(null);
      setConfirmToggleTarget(null);
    }
  };

  const getServiceWarning = (service, nextState) => {
    if (nextState) {
      return `Re-enabling ${service.name} will restore active automated workloads and notification dispatch immediately.`;
    }
    switch (service.id) {
      case 'telegram':
        return 'Instant SEV-1 mobile push notifications and 1-tap mobile triage cards to your Telegram chat will be suppressed. Real-time updates will only appear on this desktop application.';
      case 'twilio':
        return 'Emergency automated phone calls to on-call phone numbers will be completely disabled. The team will NOT receive voice phone alerts or interactive DTMF keypad remediation during critical outages.';
      case 'render_watchdog':
        return 'Continuous 15-second background health checks will pause for this production server. Automated incident detection will stop until re-enabled or manually probed.';
      case 'antigravity':
        return 'Switches the remediation pipeline to Alert-Only mode. Automatic Git worktree cloning, AST blame analysis, and candidate canary staging on ports 8001/8002 will not run.';
      case 'auto_revert':
        return 'Disables the 10-second post-deployment safety watchdog. Faulty patches deployed to production port 8000 will NOT be automatically rolled back.';
      case 'tunnel':
        return 'Closes the public Cloudflare tunnel. External mobile webhook callbacks and triage links accessed from outside localhost will stop resolving.';
      default:
        return `This will temporarily mute all automated workloads for ${service.name}.`;
    }
  };

  // Form states
  const [form, setForm] = useState({
    name: '',
    project_id: '',
    provider: 'render',
    render_service_id: '',
    render_api_key: '',
    health_url: '',
    port: 8000,
    host: '127.0.0.1'
  });

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${apiUrl}/projects`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        if (!form.project_id && data.active_project) {
          setForm((prev) => ({ ...prev, project_id: data.active_project.id }));
        }
      }
    } catch (e) {
      // silently fail
    }
  };

  const fetchServers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/servers`);
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers || []);
        setActiveServer(data.active_server || null);

        if (!selectedServerId && data.servers?.length > 0) {
          const init = data.active_server || data.servers[0];
          setSelectedServerId(init.id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch servers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscoveredServices = async () => {
    setDiscovering(true);
    try {
      const res = await fetch(`${apiUrl}/render/discover`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.services)) {
          setDiscoveredServices(data.services);
        }
      }
    } catch (e) {
      // silently ignore
    } finally {
      setDiscovering(false);
    }
  };

  useEffect(() => {
    fetchServers();
    fetchProjects();
    fetchDiscoveredServices();
  }, [apiUrl]);

  const currentServer = servers.find((s) => s.id === selectedServerId) || activeServer;

  // Fetch live Render details when a server is selected
  const fetchRenderDetails = async () => {
    if (!currentServer?.id) return;
    setDetailsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${apiUrl}/servers/${currentServer.id}/render-details`);
      if (res.ok) {
        const data = await res.json();
        setRenderDetails(data);
        if (!data.ok && data.error) setErrorMsg(data.error);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to fetch Render details');
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    fetchRenderDetails();
  }, [selectedServerId]);

  const handleProbe = async (id) => {
    setProbingId(id);
    try {
      const res = await fetch(`${apiUrl}/servers/${id}/probe`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        await fetchServers();
        await fetchRenderDetails();
        if (data.probe && data.probe.status !== 'HEALTHY') {
          alert(`Health Probe Warning: Target returned ${data.probe.status}. Reason: ${data.probe.error || 'Endpoint offline or non-200 HTTP response'}`);
        }
      } else {
        alert('Probe request failed: ' + (data.detail || res.statusText));
      }
    } catch (err) {
      alert('Probe failed: ' + err.message);
    } finally {
      setProbingId(null);
    }
  };

  const handleWakeServer = async (id) => {
    setWakingId(id);
    try {
      const res = await fetch(`${apiUrl}/servers/${id}/wake`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        await fetchServers();
        await fetchRenderDetails();
        if (data.status === 'HEALTHY') {
          alert(`Server is awake! Latency: ${data.latency_ms || 0}ms`);
        } else {
          alert(`Wake probe completed. Status: ${data.status} (${data.message || ''})`);
        }
      } else {
        alert('Wake request failed: ' + (data.detail || res.statusText));
      }
    } catch (err) {
      alert('Wake probe failed: ' + err.message);
    } finally {
      setWakingId(null);
    }
  };

  const handleActivate = async (id) => {
    try {
      const res = await fetch(`${apiUrl}/servers/${id}/activate`, { method: 'POST' });
      if (res.ok) {
        await fetchServers();
      }
    } catch (err) {
      alert('Failed to set active server');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this server connection?')) return;
    try {
      const res = await fetch(`${apiUrl}/servers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedServerId(null);
        await fetchServers();
      }
    } catch (err) {
      alert('Failed to delete server');
    }
  };

  const handleCreateServer = async (e) => {
    e.preventDefault();
    if (!form.name || !form.health_url) {
      alert('Please provide Server Name and Health Check URL.');
      return;
    }

    setRegisterProgress({
      step: 2,
      total_steps: 4,
      stage: 'probing',
      title: 'Connecting & Dispatching Live Health Probe',
      detail: `Connecting '${form.name}' and probing ${form.health_url}...`,
      logs: [
        `Target Name: ${form.name}`,
        `Health Probe Target: ${form.health_url}`,
        form.render_service_id ? `Render Service ID: ${form.render_service_id}` : 'Provider: Custom/Render Web Service',
        'Dispatching live HTTP probe...'
      ],
      status: 'running'
    });

    try {
      const res = await fetch(`${apiUrl}/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to connect server');

      const probe = data.probe || {};
      const statusText = probe.status || 'UNKNOWN';
      const isHealthy = statusText === 'HEALTHY';
      const latencyStr = probe.latency_ms ? `${probe.latency_ms.toFixed(0)}ms` : (isHealthy ? 'healthy' : 'failed');

      setRegisterProgress({
        step: 4,
        total_steps: 4,
        stage: 'completed',
        title: isHealthy ? 'Production Server Verified & Connected!' : 'Server Registered (Health Probe Alert)',
        detail: isHealthy
          ? `Status: ${statusText} • Latency: ${latencyStr} • Monitoring Active`
          : `Status: ${statusText} • Warning: ${probe.error || 'Endpoint offline or non-200 response'}`,
        logs: [
          `Probe Response: ${statusText} (${latencyStr})`,
          ...(probe.error ? [`Probe Warning: ${probe.error}`] : []),
          `Server ID: ${data.server?.id}`,
          'Watchdog health probe scheduled every 15 seconds.',
          'Autonomous SRE watchdog is active for this service.'
        ],
        status: isHealthy ? 'success' : 'warning',
        server: data.server,
        probe: probe
      });

      await fetchServers();
      if (data.server?.id) {
        setSelectedServerId(data.server.id);
      }

      if (isHealthy) {
        setTimeout(() => {
          setShowConnectModal(false);
          setRegisterProgress(null);
          setForm({
            name: '',
            project_id: '',
            provider: 'render',
            render_service_id: '',
            render_api_key: '',
            health_url: '',
            port: 8000,
            host: '127.0.0.1'
          });
        }, 1500);
      }
    } catch (err) {
      setRegisterProgress({
        step: 4,
        total_steps: 4,
        stage: 'error',
        title: 'Connection Failed',
        detail: err.message || 'Could not verify server health URL or Render credentials.',
        logs: [`Error: ${err.message}`],
        status: 'error'
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-hidden font-sans">
      {/* Top Header */}
      <div className="h-14 border-b border-[#1b2234] bg-[#0d111a] px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#161f30] border border-[#263550] flex items-center justify-center text-[#58a6ff]">
            <Server size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#f0f6fc]">Servers</h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#161f30] text-[#79c0ff] border border-[#263550] font-mono">
                {servers.length} Registered
              </span>
            </div>
            <p className="text-[11px] text-[#8b949e]">
              Uptime monitoring, health probes, and deployment tracking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {servers.length > 0 && (
            <select
              value={selectedServerId || ''}
              onChange={(e) => setSelectedServerId(e.target.value)}
              className="bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-1.5 rounded-md focus:outline-none focus:border-[#58a6ff]"
            >
              {servers.map((s) => {
                const sStatus = (s.status || 'UNKNOWN').toUpperCase();
                const iconLabel =
                  sStatus === 'HEALTHY' || sStatus === 'LIVE'
                    ? '🟢 ONLINE'
                    : sStatus === 'SLEEPING'
                    ? '💤 SLEEPING'
                    : sStatus === 'OFFLINE'
                    ? '🔴 OFFLINE'
                    : sStatus === 'DEGRADED'
                    ? '⚠️ DEGRADED'
                    : sStatus;
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} [{iconLabel}] — {s.render_service_id || 'Render'}
                  </option>
                );
              })}
            </select>
          )}

          <button
            onClick={() => {
              fetchServers();
              fetchRenderDetails();
            }}
            disabled={loading || detailsLoading}
            title="Refresh Status"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#121824] hover:bg-[#1a2334] text-[#c9d1d9] hover:text-[#f0f6fc] border border-[#222f47] text-xs font-medium transition"
          >
            <RefreshCw size={13} className={loading || detailsLoading ? 'animate-spin text-[#58a6ff]' : 'text-[#8b949e]'} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowConnectModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus size={14} />
            <span>Connect Render Server</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading && servers.length === 0 ? (
        <div className="flex-1 p-8 max-w-4xl w-full mx-auto space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 text-xs text-[#58a6ff] pb-2">
            <RefreshCw size={13} className="animate-spin" />
            <span>Discovering production servers...</span>
          </div>
          <ListItemSkeleton count={2} />
        </div>
      ) : servers.length === 0 ? (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#121824] border border-[#23314d] flex items-center justify-center text-[#58a6ff] mb-4 shadow-xl">
            <Server size={32} />
          </div>
          <h2 className="text-base font-bold text-[#f0f6fc] mb-2">No Production Servers Connected</h2>
          <p className="text-xs text-[#8b949e] max-w-md mb-6 leading-relaxed">
            Connect your live production service hosted on Render. ProdPilot queries Render's REST API
            v1 to ingest deployment logs and monitor container health. ProdPilot can prepare local remediation candidates; a Render cloud deployment or rollback adapter is not configured.
          </p>
          <button
            onClick={() => setShowConnectModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold shadow-md transition"
          >
            <Plus size={16} />
            <span>Connect Render Service</span>
          </button>
        </div>
      ) : (
        /* Selected Server View */
        <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
          {currentServer && (
            <>
              {/* Server Hero Card */}
              <div className="p-5 rounded-xl bg-[#0e1420] border border-[#1b2438]">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-base font-bold text-[#f0f6fc]">{currentServer.name}</h2>
                      
                      {/* Dynamic Status Badge */}
                      {(() => {
                        const s = (currentServer.status || 'UNKNOWN').toUpperCase();
                        if (s === 'HEALTHY' || s === 'LIVE') {
                          return (
                            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-[#122419] text-[#3fb950] border border-[#1f4a2b]">
                              <span className="w-2 h-2 rounded-full bg-[#3fb950] animate-pulse" />
                              <span>ONLINE</span>
                            </span>
                          );
                        }
                        if (s === 'SLEEPING') {
                          return (
                            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-[#241a2e] text-[#d2a8ff] border border-[#492b6a]">
                              <Moon size={11} className="text-[#d2a8ff] animate-pulse" />
                              <span>SLEEPING (Idle)</span>
                            </span>
                          );
                        }
                        if (s === 'OFFLINE') {
                          return (
                            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-[#261317] text-[#ff7b72] border border-[#4a1c24]">
                              <span className="w-2 h-2 rounded-full bg-[#ff7b72]" />
                              <span>OFFLINE</span>
                            </span>
                          );
                        }
                        if (s === 'DEGRADED' || s === 'BUILDING') {
                          return (
                            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-[#241a12] text-[#d29922] border border-[#442c16]">
                              <span className="w-2 h-2 rounded-full bg-[#d29922]" />
                              <span>{s}</span>
                            </span>
                          );
                        }
                        return (
                          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-[#161f30] text-[#79c0ff] border border-[#263550]">
                            <span className="w-2 h-2 rounded-full bg-current" />
                            <span>{s}</span>
                          </span>
                        );
                      })()}

                      {currentServer.is_active ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#161f30] text-[#79c0ff] border border-[#263550] font-bold">
                          ACTIVE PRODUCTION TARGET
                        </span>
                      ) : (
                        <button
                          onClick={() => handleActivate(currentServer.id)}
                          className="text-[10px] px-2 py-0.5 rounded bg-[#161f30] hover:bg-[#202e47] text-[#8b949e] hover:text-[#c9d1d9] border border-[#263550] transition"
                        >
                          Set as Active
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-5 mt-3 text-xs text-[#8b949e]">
                      <div className="flex items-center gap-1.5 font-mono">
                        <Globe size={13} className="text-[#58a6ff]" />
                        <a
                          href={currentServer.health_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-[#58a6ff] hover:underline"
                        >
                          {currentServer.health_url}
                        </a>
                      </div>

                      {currentServer.render_service_id && (
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#8b949e]">
                          <Layers size={13} className="text-[#a371f7]" />
                          <span>Render ID: {currentServer.render_service_id}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <Activity size={13} className="text-[#3fb950]" />
                        <span>{currentServer.latency_ms || 0} ms Latency</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start">
                    {currentServer.status === 'SLEEPING' && (
                      <button
                        onClick={() => handleWakeServer(currentServer.id)}
                        disabled={wakingId === currentServer.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7938b2] hover:bg-[#8f47d1] text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                        title="Ping origin server to trigger container cold-start spin-up"
                      >
                        <Zap size={13} className={wakingId === currentServer.id ? 'animate-bounce' : ''} />
                        <span>{wakingId === currentServer.id ? 'Waking...' : 'Wake Up'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleProbe(currentServer.id)}
                      disabled={probingId === currentServer.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#273855] text-xs font-semibold transition"
                    >
                      <Activity size={13} className={probingId === currentServer.id ? 'animate-spin' : ''} />
                      <span>{probingId === currentServer.id ? 'Probing...' : 'Probe Live Health'}</span>
                    </button>

                    <button
                      onClick={() => handleDelete(currentServer.id)}
                      title="Remove Server"
                      className="p-2 rounded-lg bg-[#1f1519] border border-[#3e1d25] text-[#ff7b72] hover:bg-[#341b23] transition text-xs"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Status Specific Context Banners */}
                {currentServer.status === 'SLEEPING' && (
                  <div className="mt-4 p-3.5 rounded-lg bg-[#1f152b] border border-[#3e245a] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
                    <div className="flex items-start gap-2.5">
                      <Moon size={16} className="text-[#d2a8ff] shrink-0 mt-0.5 animate-pulse" />
                      <div>
                        <span className="font-semibold text-[#f0f6fc]">Server is currently sleeping (Free-Tier Inactivity)</span>
                        <p className="text-[11px] text-[#c9d1d9]/80 mt-0.5 leading-relaxed">
                          Render spins free-tier instances down after 15 minutes of zero HTTP traffic. The next request triggers an automatic cold-start (~30–50s).
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleWakeServer(currentServer.id)}
                      disabled={wakingId === currentServer.id}
                      className="px-3 py-1.5 rounded-md bg-[#7938b2] hover:bg-[#8f47d1] text-white font-medium text-xs flex items-center gap-1.5 transition shrink-0 shadow-sm disabled:opacity-50"
                    >
                      <Zap size={13} className={wakingId === currentServer.id ? 'animate-bounce' : ''} />
                      <span>{wakingId === currentServer.id ? 'Waking container (up to 45s)...' : 'Wake Up Server'}</span>
                    </button>
                  </div>
                )}

                {currentServer.status === 'OFFLINE' && (
                  <div className="mt-4 p-3 rounded-lg bg-[#261317] border border-[#4a1c24] flex items-center gap-2.5 text-xs text-[#ff7b72] animate-in fade-in duration-200">
                    <WifiOff size={16} className="shrink-0" />
                    <div>
                      <span className="font-semibold text-[#ff7b72]">Server is Offline / Unreachable</span>
                      <p className="text-[11px] text-[#ff7b72]/80 mt-0.5">
                        TCP connection was refused or the host did not respond. Check your DNS routing, server container process, or firewall.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Render Cloud Service Status & Deploys */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Column 1: Render REST API Service Meta */}
                <div className="p-5 rounded-xl bg-[#0e1420] border border-[#1b2438] flex flex-col">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1b2438]">
                    <div className="flex items-center gap-2">
                      <Layers size={16} className="text-[#a371f7]" />
                      <h3 className="text-xs font-bold text-[#f0f6fc]">Render Web Service Specifications</h3>
                    </div>
                    {renderDetails?.ok && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#122419] text-[#3fb950] border border-[#1f4a2b] font-mono">
                        Render API Connected
                      </span>
                    )}
                  </div>

                  {detailsLoading && !renderDetails?.service ? (
                    <div className="py-2 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-[#58a6ff] pb-1">
                        <RefreshCw size={12} className="animate-spin" />
                        <span>Fetching Render service details...</span>
                      </div>
                      <ListItemSkeleton count={2} />
                    </div>
                  ) : renderDetails?.service ? (
                    <div className="space-y-3 text-xs">
                      <div className="flex justify-between py-1 border-b border-[#161f30]">
                        <span className="text-[#8b949e]">Service Name</span>
                        <span className="font-mono text-[#f0f6fc]">{renderDetails.service.name}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#161f30]">
                        <span className="text-[#8b949e]">Service Type</span>
                        <span className="font-mono text-[#79c0ff] uppercase">{renderDetails.service.type}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#161f30]">
                        <span className="text-[#8b949e]">Environment</span>
                        <span className="font-mono text-[#d2a8ff]">{renderDetails.service.env}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#161f30]">
                        <span className="text-[#8b949e]">Region</span>
                        <span className="font-mono text-[#f0f6fc]">{renderDetails.service.region}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#161f30]">
                        <span className="text-[#8b949e]">Auto-Deploy</span>
                        <span className="font-mono text-[#3fb950]">
                          {renderDetails.service.autoDeploy === 'yes' ? 'Enabled' : 'Manual'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#161f30]">
                        <span className="text-[#8b949e]">Plan & Sleep Policy</span>
                        <span className="font-mono text-[#d2a8ff]">
                          {renderDetails.service.plan ? renderDetails.service.plan.toUpperCase() : 'FREE'} • {renderDetails.sleep_policy || 'Spins down after 15m idle'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#161f30]">
                        <span className="text-[#8b949e]">Container State</span>
                        <span className="font-mono flex items-center gap-1.5">
                          {currentServer.status === 'HEALTHY' || currentServer.status === 'LIVE' ? (
                            <span className="text-[#3fb950] flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse" />
                              Awake & Responding
                            </span>
                          ) : currentServer.status === 'SLEEPING' ? (
                            <span className="text-[#d2a8ff] flex items-center gap-1">
                              <Moon size={11} className="text-[#d2a8ff]" />
                              Asleep (Spun Down)
                            </span>
                          ) : (
                            <span className="text-[#ff7b72] flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#ff7b72]" />
                              Offline / Unreachable
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-[#8b949e]">Updated</span>
                        <span className="font-mono text-[#c9d1d9]" title={formatDate(renderDetails.service.updated_at || renderDetails.service.updatedAt)}>
                          {formatRelativeTime(renderDetails.service.updated_at || renderDetails.service.updatedAt)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center border border-dashed border-[#1b2234] rounded-lg">
                      <ShieldAlert size={24} className="mx-auto text-[#d29922] mb-2" />
                      <p className="text-xs text-[#f0f6fc] font-semibold">Render Details Unavailable</p>
                      <p className="text-[11px] text-[#8b949e] mt-1 max-w-xs mx-auto">
                        {renderDetails?.error ||
                          'Configure Render Service ID and API Key to fetch live container configurations.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Column 2: Render Deployments History */}
                <div className="p-5 rounded-xl bg-[#0e1420] border border-[#1b2438] flex flex-col">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1b2438]">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-[#58a6ff]" />
                      <h3 className="text-xs font-bold text-[#f0f6fc]">Render Deploy History</h3>
                    </div>
                    <span className="text-[10px] text-[#8b949e] font-mono">
                      {renderDetails?.deploys?.length || 0} Deploys
                    </span>
                  </div>

                  {detailsLoading && (!renderDetails?.deploys || renderDetails.deploys.length === 0) ? (
                    <div className="py-2 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-[#58a6ff] pb-1">
                        <RefreshCw size={12} className="animate-spin" />
                        <span>Querying deployment history...</span>
                      </div>
                      <ListItemSkeleton count={2} />
                    </div>
                  ) : renderDetails?.deploys && renderDetails.deploys.length > 0 ? (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {renderDetails.deploys.map((dep) => {
                        const depDate = dep.created_at || dep.createdAt;
                        const commitId = dep.commit_id || dep.commit?.id?.slice(0, 7) || 'HEAD';
                        const commitMsg = dep.commit_message || dep.commit?.message || 'Deploy initiated';
                        const statusLower = (dep.status || '').toLowerCase();

                        return (
                          <div
                            key={dep.id}
                            className="p-3 rounded-lg bg-[#080b11] border border-[#1b2438] flex items-center justify-between"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold font-mono text-[#f0f6fc]">{dep.id}</span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold uppercase border ${
                                    statusLower === 'live'
                                      ? 'bg-[#122419] text-[#3fb950] border-[#1f4a2b]'
                                      : statusLower === 'build_failed'
                                      ? 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]'
                                      : 'bg-[#161f30] text-[#79c0ff] border-[#263550]'
                                  }`}
                                >
                                  {dep.status}
                                </span>
                              </div>

                              <p className="text-[11px] text-[#8b949e] mt-1 line-clamp-1 font-sans">
                                {commitMsg}
                              </p>

                              <div className="flex items-center gap-3 mt-1 text-[10px] text-[#6e7681] font-mono">
                                <span>Commit: {commitId}</span>
                                <span>•</span>
                                <span title={formatDate(depDate)}>{formatRelativeTime(depDate)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 text-center border border-dashed border-[#1b2234] rounded-lg">
                      <Clock size={24} className="mx-auto text-[#8b949e] mb-2" />
                      <p className="text-xs text-[#f0f6fc] font-semibold">No Deployments Recorded</p>
                      <p className="text-[11px] text-[#8b949e] mt-1">
                        Connect a valid Render API Key to query deploys from api.render.com.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Active Services & Alert Controls */}
              <div className="p-5 rounded-xl bg-[#0e1420] border border-[#1b2438] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#1b2438]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#161f30] border border-[#263550] flex items-center justify-center text-[#58a6ff]">
                      <Radio size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-[#f0f6fc]">Active Services & Alert Controls</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-[#161f30] text-[#79c0ff] border border-[#263550]">
                          {platformServices.filter((s) => s.enabled).length} / {platformServices.length} Active
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8b949e]">
                        Toggle alert dispatch, emergency telephony, automated canary reproduction, and safety rollbacks
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={fetchPlatformServices}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-[#121824] hover:bg-[#1b2438] text-[#8b949e] hover:text-[#f0f6fc] border border-[#222f47] transition self-start sm:self-auto"
                    title="Refresh services"
                  >
                    <RefreshCw size={12} className={servicesLoading ? 'animate-spin' : ''} />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {platformServices.map((svc) => {
                    const IconComponent = SERVICE_ICONS_MAP[svc.id] || Server;
                    const isOnline = svc.status === 'ONLINE';
                    const isMuted = !svc.enabled || svc.status === 'MUTED';

                    return (
                      <div
                        key={svc.id}
                        className={`p-3.5 rounded-lg border transition flex flex-col justify-between space-y-3 ${
                          isMuted
                            ? 'bg-[#090b10] border-[#1b202c] opacity-80'
                            : 'bg-[#080b11] border-[#1b2438] hover:border-[#2b3a5a]'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border ${
                                  isMuted
                                    ? 'bg-[#1c180e] border-[#3b2e13] text-[#d29922]'
                                    : isOnline
                                    ? 'bg-[#122419] border-[#1f4a2b] text-[#3fb950]'
                                    : 'bg-[#161f30] border-[#263550] text-[#79c0ff]'
                                }`}
                              >
                                <IconComponent size={14} />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-[#f0f6fc] truncate">{svc.name}</h4>
                                <span className="text-[10px] text-[#8b949e] block truncate">{svc.role}</span>
                              </div>
                            </div>

                            {/* Toggle switch button */}
                            <button
                              type="button"
                              disabled={togglingServiceId === svc.id}
                              onClick={() => setConfirmToggleTarget({ service: svc, nextState: !svc.enabled })}
                              title={svc.enabled ? `Click to mute ${svc.name}` : `Click to enable ${svc.name}`}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                                svc.enabled ? 'bg-[#238636]' : 'bg-[#21262d]'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  svc.enabled ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>

                          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border uppercase flex items-center gap-1 ${
                                isMuted
                                  ? 'bg-[#241a12] text-[#d29922] border-[#442c16]'
                                  : isOnline
                                  ? 'bg-[#122419] text-[#3fb950] border-[#1f4a2b]'
                                  : 'bg-[#161f30] text-[#79c0ff] border-[#263550]'
                              }`}
                            >
                              <span className="w-1 h-1 rounded-full bg-current" />
                              {isMuted ? 'MUTED' : svc.status}
                            </span>

                            <span className="text-[9px] font-mono text-[#6e7681] px-1 py-0.2 rounded bg-[#0d111a] border border-[#1b2234]">
                              {svc.category}
                            </span>
                          </div>

                          <p className="text-[11px] text-[#8b949e] mt-2 line-clamp-2 leading-relaxed">
                            {svc.activity}
                          </p>
                        </div>

                        {svc.id === 'twilio' && !svc.configured && (
                          <div className="pt-1 text-[10px] text-[#d29922] font-mono flex items-center gap-1">
                            <span>* Twilio Auth Token needed in Settings</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Confirmation Modal for Toggling Platform Services */}
      {confirmToggleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#0e1420] border border-[#2a3854] rounded-xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  confirmToggleTarget.nextState
                    ? 'bg-[#122419] border-[#1f4a2b] text-[#3fb950]'
                    : 'bg-[#2d1217] border-[#541f27] text-[#ff7b72]'
                }`}
              >
                {confirmToggleTarget.nextState ? <Power size={20} /> : <AlertTriangle size={20} />}
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="text-sm font-bold text-[#f0f6fc]">
                  {confirmToggleTarget.nextState ? 'Enable' : 'Confirm Muting'}{' '}
                  <span className="text-[#58a6ff]">{confirmToggleTarget.service.name}</span>?
                </h3>
                <p className="text-xs text-[#8b949e]">{confirmToggleTarget.service.role}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-[#080b11] border border-[#1b2438] text-xs text-[#c9d1d9] leading-relaxed">
              {getServiceWarning(confirmToggleTarget.service, confirmToggleTarget.nextState)}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmToggleTarget(null)}
                className="px-3.5 py-2 text-xs font-medium rounded-lg bg-[#161f30] hover:bg-[#222f47] text-[#c9d1d9] border border-[#222f47] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={togglingServiceId !== null}
                onClick={handleExecuteToggle}
                className={`px-4 py-2 text-xs font-bold rounded-lg text-white transition flex items-center gap-1.5 shadow-sm ${
                  confirmToggleTarget.nextState
                    ? 'bg-[#238636] hover:bg-[#2ea043]'
                    : 'bg-[#da3633] hover:bg-[#b62324]'
                }`}
              >
                {togglingServiceId ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : confirmToggleTarget.nextState ? (
                  <Check size={13} />
                ) : (
                  <Power size={13} />
                )}
                <span>
                  {confirmToggleTarget.nextState ? 'Yes, Enable Service' : 'Yes, Mute Service'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connect Server Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-[#0e1420] border border-[#23314d] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#1b2438] flex items-center justify-between bg-[#121824]">
              <div className="flex items-center gap-2">
                <Server size={16} className="text-[#58a6ff]" />
                <h3 className="text-sm font-bold text-[#f0f6fc]">Connect Render Production Server</h3>
              </div>
              <button
                onClick={() => setShowConnectModal(false)}
                className="text-[#8b949e] hover:text-[#f0f6fc] text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {registerProgress ? (
              <div className="p-6 space-y-5 animate-in fade-in duration-200">
                {/* Status Bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {registerProgress.status === 'running' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-[#58a6ff] animate-ping" />
                    )}
                    {registerProgress.status === 'success' && (
                      <CheckCircle2 size={16} className="text-[#3fb950]" />
                    )}
                    {registerProgress.status === 'warning' && (
                      <AlertTriangle size={16} className="text-[#d29922]" />
                    )}
                    {registerProgress.status === 'error' && (
                      <AlertTriangle size={16} className="text-[#f85149]" />
                    )}
                    <span className="text-xs font-bold text-[#f0f6fc] tracking-wide uppercase">
                      {registerProgress.status === 'running'
                        ? 'Provisioning & Probing Server...'
                        : registerProgress.status === 'success'
                        ? 'Server Connected & Verified'
                        : registerProgress.status === 'warning'
                        ? 'Connected (Health Probe Alert)'
                        : 'Registration Failed'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#8b949e]">
                    Step {registerProgress.step} of {registerProgress.total_steps}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-[#161f30] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      registerProgress.status === 'error'
                        ? 'bg-[#f85149]'
                        : registerProgress.status === 'success'
                        ? 'bg-[#3fb950]'
                        : 'bg-gradient-to-r from-[#58a6ff] to-[#3fb950]'
                    }`}
                    style={{
                      width: `${(registerProgress.step / registerProgress.total_steps) * 100}%`
                    }}
                  />
                </div>

                {/* Step Cards */}
                <div className="space-y-2.5">
                  {[
                    { num: 1, title: 'Validating Configuration & Target', desc: `Target: ${form.name}` },
                    { num: 2, title: 'Probing Live Health Check URL', desc: form.health_url },
                    { num: 3, title: 'Verifying Cloud Telemetry & Render API', desc: form.render_service_id || 'Standard health probe' },
                    { num: 4, title: 'Activating Watchdog & Monitoring', desc: 'Polling every 15s for 5xx downtime & latency' }
                  ].map((s) => {
                    const isDone = registerProgress.step > s.num || (registerProgress.step === s.num && registerProgress.status === 'success');
                    const isCurrent = registerProgress.step === s.num && registerProgress.status === 'running';
                    const isFailed = registerProgress.step === s.num && registerProgress.status === 'error';

                    return (
                      <div
                        key={s.num}
                        className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all ${
                          isDone
                            ? 'bg-[#121d2f]/60 border-[#23426e] text-[#f0f6fc]'
                            : isCurrent
                            ? 'bg-[#16233b] border-[#388bfd] text-[#58a6ff] shadow-sm shadow-[#388bfd]/20'
                            : isFailed
                            ? 'bg-[#2d1216] border-[#f85149] text-[#ff7b72]'
                            : 'bg-[#090d16]/40 border-[#1a2336] text-[#6e7681]'
                        }`}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {isDone ? (
                            <CheckCircle2 size={15} className="text-[#3fb950]" />
                          ) : isCurrent ? (
                            <RefreshCw size={15} className="text-[#58a6ff] animate-spin" />
                          ) : isFailed ? (
                            <AlertTriangle size={15} className="text-[#f85149]" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-[#30363d] flex items-center justify-center text-[9px] font-mono">
                              {s.num}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold leading-tight">{s.title}</div>
                          <div className="text-[11px] text-[#8b949e] truncate mt-0.5">{s.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Live Console Output */}
                <div className="bg-[#05070c] border border-[#1b2438] rounded-lg p-3 font-mono text-[11px] text-[#79c0ff] space-y-1 max-h-32 overflow-y-auto">
                  <div className="text-[10px] text-[#484f58] uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
                    <Terminal size={11} />
                    <span>Telemetry Provisioning Console</span>
                  </div>
                  {registerProgress.logs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-[#c9d1d9]">
                      <span className="text-[#58a6ff] select-none">&gt;</span>
                      <span className="break-all">{log}</span>
                    </div>
                  ))}
                  {registerProgress.status === 'running' && (
                    <div className="flex items-center gap-1 text-[#8b949e]">
                      <span className="inline-block w-1.5 h-3 bg-[#58a6ff] animate-pulse" />
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#1b2438]">
                  {registerProgress.status === 'error' ? (
                    <button
                      type="button"
                      onClick={() => setRegisterProgress(null)}
                      className="px-4 py-2 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-[#f0f6fc] text-xs font-semibold transition"
                    >
                      Back to Edit Form
                    </button>
                  ) : registerProgress.status === 'success' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowConnectModal(false);
                        setRegisterProgress(null);
                      }}
                      className="px-5 py-2 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-bold transition flex items-center gap-1.5 shadow"
                    >
                      <CheckCircle2 size={13} />
                      <span>View Server Dashboard</span>
                    </button>
                  ) : registerProgress.status === 'warning' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowConnectModal(false);
                        setRegisterProgress(null);
                      }}
                      className="px-5 py-2 rounded-lg bg-[#b08800] hover:bg-[#c69a00] text-black text-xs font-bold transition flex items-center gap-1.5 shadow"
                    >
                      <AlertTriangle size={13} />
                      <span>Acknowledge Warning & View Server</span>
                    </button>
                  ) : (
                    <div className="text-xs text-[#8b949e] flex items-center gap-2">
                      <RefreshCw size={12} className="animate-spin text-[#58a6ff]" />
                      <span>Verifying endpoints...</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
            <form onSubmit={handleCreateServer} className="p-6 space-y-4">
              {/* Discovered Render Services */}
              {discoveredServices.length > 0 && (
                <div className="bg-[#121929] border border-[#223554] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-[#79c0ff] flex items-center gap-1.5">
                      <Sparkles size={13} className="text-[#e3b341]" />
                      Discovered Render Services ({discoveredServices.length})
                    </span>
                    <button
                      type="button"
                      onClick={fetchDiscoveredServices}
                      className="text-[10px] text-[#8b949e] hover:text-[#f0f6fc] flex items-center gap-1"
                    >
                      <RefreshCw size={10} className={discovering ? 'animate-spin' : ''} />
                      {discovering ? 'Scanning...' : 'Rescan'}
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {discoveredServices.map((svc) => (
                      <div
                        key={svc.id}
                        className="flex items-center justify-between p-2 rounded bg-[#090d16] border border-[#1b273d] hover:border-[#388bfd] text-xs transition-colors"
                      >
                        <div className="truncate mr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[#f0f6fc]">{svc.name}</span>
                            <span className="text-[9px] px-1 py-0.2 rounded font-mono uppercase bg-[#1f293d] text-[#8b949e]">
                              {svc.type}
                            </span>
                            {svc.suspended === 'not_suspended' && (
                              <span className="text-[9px] px-1 py-0.2 rounded font-mono text-[#3fb950] bg-[#238636]/20">
                                active
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-[#8b949e] block font-mono truncate">{svc.url || svc.id}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              name: svc.name,
                              render_service_id: svc.id,
                              health_url: svc.url ? `${svc.url.replace(/\/$/, '')}${svc.healthCheckPath || '/health'}` : prev.health_url,
                              provider: 'render'
                            }));
                          }}
                          className="shrink-0 px-2.5 py-1 bg-[#238636] hover:bg-[#2ea043] text-white rounded text-[11px] font-semibold transition-colors shadow-xs"
                        >
                          Auto-Fill
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#c9d1d9] mb-1">
                  Attached Project <span className="text-[#8b949e] font-normal">(Optional)</span>
                </label>
                <select
                  value={form.project_id}
                  onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                  className="w-full bg-[#080b11] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-lg focus:outline-none focus:border-[#58a6ff]"
                >
                  <option value="">-- No Specific Project --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.github_repo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#c9d1d9] mb-1">
                  Server Name <span className="text-[#ff7b72]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. chunkstream-prod"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#080b11] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-lg focus:outline-none focus:border-[#58a6ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#c9d1d9] mb-1">
                  Health Check URL <span className="text-[#ff7b72]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. https://chunkstream-prod.onrender.com/health"
                  value={form.health_url}
                  onChange={(e) => setForm({ ...form, health_url: e.target.value })}
                  className="w-full bg-[#080b11] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-lg focus:outline-none focus:border-[#58a6ff] font-mono"
                />
                <p className="text-[10px] text-[#8b949e] mt-1">
                  Queried by ProdPilot's health probe every 15 seconds.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#c9d1d9] mb-1">
                  Render Service ID <span className="text-[#8b949e] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="srv-cr..."
                  value={form.render_service_id}
                  onChange={(e) => setForm({ ...form, render_service_id: e.target.value })}
                  className="w-full bg-[#080b11] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-lg focus:outline-none focus:border-[#58a6ff] font-mono"
                />
                <p className="text-[10px] text-[#8b949e] mt-1">
                  Found in Render service dashboard URL (e.g. <code className="text-[#79c0ff]">srv-crxxxxxxxxxxxx</code>).
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[#c9d1d9]">
                    Render API Key <span className="text-[#8b949e] font-normal">(Optional)</span>
                  </label>
                  <a
                    href="https://dashboard.render.com/u/settings#api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#58a6ff] hover:text-[#79c0ff] hover:underline text-[11px] inline-flex items-center gap-1 font-medium"
                    title="Open Render Account Settings -> API Keys"
                  >
                    <span>Get Key on Render</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
                <input
                  type="password"
                  placeholder="rnd_xxxxxxxxxxxx (leave blank to use Global Key from Settings)"
                  value={form.render_api_key}
                  onChange={(e) => setForm({ ...form, render_api_key: e.target.value })}
                  className="w-full bg-[#080b11] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-lg focus:outline-none focus:border-[#58a6ff] font-mono"
                />
                <p className="text-[10px] text-[#8b949e] mt-1">
                  Per-server override. If empty, uses Render API Key saved in Settings.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1b2438]">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#161f30] hover:bg-[#1f2b40] text-[#c9d1d9] text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-bold shadow transition"
                >
                  Register Server
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
