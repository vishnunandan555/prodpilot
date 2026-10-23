import React, { useState, useEffect } from 'react';
import {
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
  Zap,
  Radio,
  Layers,
  ArrowUpRight,
  Plus,
  Trash2,
  Check,
  Clock,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';

export default function ServicesView({ apiConnected = true, apiUrl = 'http://127.0.0.1:8765' }) {
  const [servers, setServers] = useState([]);
  const [activeServer, setActiveServer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pingingId, setPingingId] = useState(null);
  const [showConnectModal, setShowConnectModal] = useState(false);

  // Form states
  const [serverName, setServerName] = useState('chunkstream');
  const [healthUrl, setHealthUrl] = useState('http://127.0.0.1:8000/health');
  const [port, setPort] = useState(8000);
  const [host, setHost] = useState('127.0.0.1');
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState(null);
  const [connectSuccess, setConnectSuccess] = useState(null);

  const fetchServers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/servers`);
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers || []);
        setActiveServer(data.active_server || null);
      }
    } catch (err) {
      console.warn('Failed to fetch servers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, [apiUrl]);

  const handlePing = async (serverId) => {
    setPingingId(serverId);
    try {
      const res = await fetch(`${apiUrl}/servers/${serverId}/ping`, { method: 'POST' });
      if (res.ok) {
        fetchServers();
      }
    } catch (err) {
      console.error('Ping failed:', err);
    } finally {
      setTimeout(() => setPingingId(null), 400);
    }
  };

  const handleConnectServer = async (e) => {
    e.preventDefault();
    setConnectLoading(true);
    setConnectError(null);
    setConnectSuccess(null);

    try {
      const res = await fetch(`${apiUrl}/servers/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: serverName.trim(),
          health_url: healthUrl.trim(),
          port: Number(port),
          host: host.trim(),
          set_active: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to connect server');
      }

      setConnectSuccess(`Server '${serverName}' probed: ${data.probe?.status} (${data.probe?.latency_ms || 0}ms)`);
      setTimeout(() => {
        setShowConnectModal(false);
        setConnectSuccess(null);
        fetchServers();
      }, 1000);
    } catch (err) {
      setConnectError(err.message || 'Failed to connect server');
    } finally {
      setConnectLoading(false);
    }
  };

  const handleActivateServer = async (serverId) => {
    try {
      await fetch(`${apiUrl}/servers/${serverId}/activate`, { method: 'POST' });
      fetchServers();
    } catch (err) {
      console.error('Failed to activate server:', err);
    }
  };

  const handleDeleteServer = async (serverId) => {
    try {
      await fetch(`${apiUrl}/servers/${serverId}`, { method: 'DELETE' });
      fetchServers();
    } catch (err) {
      console.error('Failed to delete server:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-y-auto font-sans">
      {/* Header */}
      <div className="border-b border-[#1b2234] bg-[#0d111a] px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#171f30] border border-[#293652] flex items-center justify-center text-[#58a6ff]">
              <Server size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-[#f0f6fc] tracking-tight">
                  Monitored Services & Endpoints
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b]">
                  {servers.length} TARGETS
                </span>
              </div>
              <p className="text-[11px] text-[#8b949e] font-mono">
                Port allocations, canary health probes, p99 latency stats & watchdog circuit breaker
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConnectModal(true)}
              className="px-2.5 py-1 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-mono flex items-center gap-1.5 transition"
            >
              <Plus size={13} />
              <span>Connect Server</span>
            </button>
            <button
              onClick={fetchServers}
              className="p-1 rounded bg-[#171f30] hover:bg-[#1f293d] border border-[#293652] text-[#8b949e] hover:text-[#f0f6fc] transition"
              title="Refresh servers"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 max-w-5xl w-full mx-auto space-y-4">
        {/* Core Control Plane Orchestrator (Live Daemon) */}
        <div className="rounded-lg bg-[#0d111a] border border-[#1b2234] p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1b2234] pb-2">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${apiConnected ? 'bg-[#3fb950]' : 'bg-[#f85149]'}`} />
              <h2 className="text-xs font-semibold text-[#f0f6fc] font-mono uppercase tracking-wider">
                ProdPilot Control Plane
              </h2>
            </div>
            <span className="text-[10px] font-mono text-[#58a6ff]">DAEMON CORE</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
            <div>
              <p className="text-[#f0f6fc] font-semibold">FastAPI Background Engine & Ingest API</p>
              <p className="text-[11px] text-[#6e7681] mt-0.5">
                URL: <code className="text-[#58a6ff]">{apiUrl}</code> • SSE Stream Active • SQLite Database Synced
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${apiConnected ? 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]' : 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]'}`}>
                {apiConnected ? '200 OK CONNECTED' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>

        {/* User-Connected Target Servers */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#8b949e]">
              Connected Target Services ({servers.length})
            </h2>
            <span className="text-[10px] font-mono text-[#6e7681]">Actively probed for latency and 5xx errors</span>
          </div>

          {servers.length === 0 ? (
            <div className="p-8 rounded-lg bg-[#0d111a] border border-[#1b2234] text-center space-y-2">
              <Server size={24} className="mx-auto text-[#6e7681]" />
              <p className="text-xs font-mono text-[#c9d1d9]">No target servers connected yet</p>
              <p className="text-[11px] font-mono text-[#8b949e] max-w-md mx-auto">
                Connect your backend microservice (e.g. ChunkStream on port 8000, Render edge deployment, or FastAPI service) to begin live health probing.
              </p>
              <button
                onClick={() => setShowConnectModal(true)}
                className="mt-2 px-3 py-1.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-mono inline-flex items-center gap-1.5 transition"
              >
                <Plus size={13} />
                <span>Connect Server</span>
              </button>
            </div>
          ) : (
            servers.map((srv) => {
              const isActive = srv.is_active === 1 || activeServer?.id === srv.id;
              const isHealthy = srv.status === 'HEALTHY';
              const isError = srv.status === 'ERROR';

              return (
                <div
                  key={srv.id}
                  className={`p-3.5 rounded-lg bg-[#0d111a] border transition space-y-2.5 ${
                    isActive
                      ? 'border-[#388bfd] border-l-4 border-l-[#58a6ff]'
                      : 'border-[#1b2234] hover:border-[#293652]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1b2234] pb-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          isHealthy ? 'bg-[#3fb950]' : isError ? 'bg-[#f85149]' : 'bg-[#8b949e]'
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-[#f0f6fc] font-mono">{srv.name}</h3>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#07090f] text-[#8b949e] border border-[#1b2234]">
                            Port {srv.port}
                          </span>
                          {isActive && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b] font-bold">
                              PRIMARY TARGET
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-[#8b949e] mt-0.5">
                          Probe URL: <code className="text-[#58a6ff]">{srv.health_url}</code>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono">
                      <button
                        onClick={() => handlePing(srv.id)}
                        disabled={pingingId === srv.id}
                        className="px-2 py-0.5 rounded bg-[#171f30] hover:bg-[#1f293d] border border-[#293652] text-[#58a6ff] text-[11px] flex items-center gap-1 disabled:opacity-50"
                      >
                        <RefreshCw size={10} className={pingingId === srv.id ? 'animate-spin' : ''} />
                        <span>Ping</span>
                      </button>
                      {!isActive && (
                        <button
                          onClick={() => handleActivateServer(srv.id)}
                          className="px-2 py-0.5 rounded bg-[#161b26] hover:bg-[#212a3d] border border-[#212a3d] text-[#c9d1d9] text-[11px]"
                        >
                          Set Primary
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteServer(srv.id)}
                        className="p-1 rounded text-[#6e7681] hover:text-[#ff7b72] transition"
                        title="Disconnect server"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono pt-1 text-[#8b949e]">
                    <div>
                      <span className="text-[#6e7681] block text-[10px]">STATUS</span>
                      <span className={`font-semibold ${isHealthy ? 'text-[#3fb950]' : isError ? 'text-[#ff7b72]' : 'text-[#8b949e]'}`}>
                        {srv.status || 'UNKNOWN'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#6e7681] block text-[10px]">LATENCY</span>
                      <span className="text-[#c9d1d9]">{srv.latency_ms !== null ? `${srv.latency_ms}ms` : '--'}</span>
                    </div>
                    <div>
                      <span className="text-[#6e7681] block text-[10px]">HOST</span>
                      <span className="text-[#c9d1d9]">{srv.host || '127.0.0.1'}</span>
                    </div>
                    <div>
                      <span className="text-[#6e7681] block text-[10px]">WATCHDOG</span>
                      <span className="text-[#3fb950]">Active (10s revert)</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Connect Server Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0d111a] border border-[#1b2234] rounded-xl shadow-2xl overflow-hidden font-sans">
            <div className="bg-[#07090f] px-5 py-4 border-b border-[#1b2234] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server size={16} className="text-[#58a6ff]" />
                <h3 className="text-xs font-bold text-[#f0f6fc] font-mono">Connect Production Server / Microservice</h3>
              </div>
              <button onClick={() => setShowConnectModal(false)} className="text-[#6e7681] hover:text-[#f0f6fc]">
                ✕
              </button>
            </div>

            <form onSubmit={handleConnectServer} className="p-5 space-y-3.5">
              {connectError && (
                <div className="p-2.5 rounded bg-[#261317] border border-[#4a1c24] text-[#ff7b72] text-xs font-mono flex items-center gap-2">
                  <AlertTriangle size={14} className="flex-shrink-0" />
                  <span>{connectError}</span>
                </div>
              )}

              {connectSuccess && (
                <div className="p-2.5 rounded bg-[#0d1e17] border border-[#1b3d2b] text-[#3fb950] text-xs font-mono flex items-center gap-2">
                  <CheckCircle2 size={14} className="flex-shrink-0" />
                  <span>{connectSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-mono text-[#8b949e] mb-1">Service Name</label>
                <input
                  type="text"
                  required
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="chunkstream"
                  className="w-full px-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#8b949e] mb-1">Host / Domain</label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="127.0.0.1"
                    className="w-full px-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-[#8b949e] mb-1">Port</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="8000"
                    className="w-full px-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#8b949e] mb-1">Health Probe URL</label>
                <input
                  type="text"
                  required
                  value={healthUrl}
                  onChange={(e) => setHealthUrl(e.target.value)}
                  placeholder="http://127.0.0.1:8000/health"
                  className="w-full px-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                />
                <span className="text-[10px] font-mono text-[#6e7681] mt-0.5 block">
                  ProdPilot will probe this endpoint every 5s for HTTP 200 responses.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-3 py-1.5 rounded bg-[#161b26] hover:bg-[#212a3d] border border-[#212a3d] text-xs font-mono text-[#8b949e] hover:text-[#c9d1d9]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectLoading}
                  className="px-4 py-1.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-mono font-medium disabled:opacity-50 flex items-center gap-1.5"
                >
                  {connectLoading ? 'Probing Target...' : 'Connect & Probe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
