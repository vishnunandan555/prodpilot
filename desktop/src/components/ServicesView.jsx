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
  WifiOff
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

  // Staging and core service defaults
  const stagingServices = [
    {
      id: 'canary-fix',
      name: 'canary-fix-forward (Remediation)',
      port: 8001,
      env: 'Staging Canary',
      status: 'HEALTHY',
      healthUrl: 'http://127.0.0.1:8001/health',
      uptime: '100%',
      p99: '9.8ms',
      description: 'Patched target with Antigravity fix. 100% tests pass.',
    },
    {
      id: 'canary-rollback',
      name: 'canary-rollback (Reversion)',
      port: 8002,
      env: 'Staging Canary',
      status: 'HEALTHY',
      healthUrl: 'http://127.0.0.1:8002/health',
      uptime: '100%',
      p99: '11.0ms',
      description: 'Known-good build staged for zero-downtime instant rollback.',
    },
    {
      id: 'prodpilot-core',
      name: 'prodpilot-core (Local Daemon)',
      port: 8765,
      env: 'Control Plane',
      status: apiConnected ? 'HEALTHY' : 'OFFLINE',
      healthUrl: 'http://127.0.0.1:8765/health',
      uptime: '100%',
      p99: '1.2ms',
      description: 'FastAPI local daemon orchestrating SSE streams and worktree sandbox.',
    }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-y-auto font-sans">
      {/* Matte SRE Header */}
      <div className="border-b border-[#1b2234] bg-[#0d111a] px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#171f30] border border-[#293652] flex items-center justify-center text-[#58a6ff]">
              <Server size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-[#f0f6fc] tracking-tight">
                  Monitored Services & Staging Canaries
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b]">
                  {servers.length + stagingServices.length} SERVICES
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
              <RotateCcw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 max-w-5xl w-full mx-auto space-y-5">
        {/* Connected Production Servers */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#8b949e]">
              Connected Target Servers
            </h2>
            <span className="text-[10px] font-mono text-[#6e7681]">Active server monitored for 5xx errors</span>
          </div>

          {servers.length === 0 ? (
            <div className="p-6 rounded-lg bg-[#0d111a] border border-[#1b2234] text-center space-y-2">
              <Server size={24} className="mx-auto text-[#6e7681]" />
              <p className="text-xs font-mono text-[#c9d1d9]">No custom server registered yet</p>
              <p className="text-[11px] font-mono text-[#8b949e]">
                Connect your test server (e.g. chunkstream on :8000) to monitor live health & latency.
              </p>
              <button
                onClick={() => setShowConnectModal(true)}
                className="mt-2 px-3 py-1.5 rounded bg-[#238636] text-white text-xs font-mono inline-flex items-center gap-1.5"
              >
                <Plus size={13} />
                <span>Connect Server Now</span>
              </button>
            </div>
          ) : (
            servers.map((s) => {
              const isPinging = pingingId === s.id;
              const isActive = s.is_active === 1 || activeServer?.id === s.id;
              const isHealthy = s.status === 'HEALTHY';
              const isDegraded = s.status === 'DEGRADED';
              const isOffline = s.status === 'OFFLINE' || s.status === 'UNKNOWN';

              return (
                <div
                  key={s.id}
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
                          isHealthy
                            ? 'bg-[#3fb950]'
                            : isDegraded
                            ? 'bg-[#d29922]'
                            : 'bg-[#ff7b72]'
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-[#f0f6fc] font-mono">{s.name}</h3>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#171f30] text-[#c9d1d9] border border-[#293652]">
                            Port {s.port}
                          </span>
                          {isActive && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b] font-bold">
                              ACTIVE TARGET
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-[#8b949e] mt-0.5">
                          Health URL: <code className="text-[#58a6ff]">{s.health_url}</code>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono">
                      <button
                        onClick={() => handlePing(s.id)}
                        disabled={isPinging}
                        className="px-2 py-0.5 rounded bg-[#171f30] hover:bg-[#1f293d] border border-[#293652] text-[#c9d1d9] text-[11px] flex items-center gap-1 transition"
                      >
                        <RotateCcw size={10} className={isPinging ? 'animate-spin' : ''} />
                        <span>Probe</span>
                      </button>

                      {!isActive && (
                        <button
                          onClick={() => handleActivateServer(s.id)}
                          className="px-2 py-0.5 rounded bg-[#171f30] hover:bg-[#1f293d] border border-[#293652] text-[#58a6ff] text-[11px]"
                        >
                          Set Active
                        </button>
                      )}

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          isHealthy
                            ? 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]'
                            : isDegraded
                            ? 'bg-[#2b200d] text-[#e3b341] border-[#543e11]'
                            : 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]'
                        }`}
                      >
                        {s.status}
                      </span>

                      <button
                        onClick={() => handleDeleteServer(s.id)}
                        className="p-1 rounded text-[#6e7681] hover:text-[#ff7b72] transition"
                        title="Delete server"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono pt-0.5 text-[#8b949e]">
                    <div>
                      <span className="text-[#6e7681] block text-[10px]">HOST</span>
                      <span className="text-[#c9d1d9]">{s.host || '127.0.0.1'}</span>
                    </div>
                    <div>
                      <span className="text-[#6e7681] block text-[10px]">LATENCY</span>
                      <span className="text-[#3fb950]">{s.latency_ms ? `${s.latency_ms}ms` : '--'}</span>
                    </div>
                    <div>
                      <span className="text-[#6e7681] block text-[10px]">LAST CHECKED</span>
                      <span className="text-[#c9d1d9] truncate block">{s.last_checked_at ? s.last_checked_at.slice(11, 19) : 'Just now'}</span>
                    </div>
                    <div>
                      <span className="text-[#6e7681] block text-[10px]">WATCHDOG</span>
                      <span className="text-[#58a6ff]">10s Circuit Breaker</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Staging Canaries & Local Control Plane */}
        <div className="space-y-3">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#8b949e]">
            Canary Ports & Autonomous Infrastructure
          </h2>

          <div className="space-y-2.5">
            {stagingServices.map((cs) => (
              <div
                key={cs.id}
                className="p-3.5 rounded-lg bg-[#0d111a] border border-[#1b2234] space-y-2 hover:border-[#293652] transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1b2234] pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#3fb950]" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-[#f0f6fc] font-mono">{cs.name}</h3>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#171f30] text-[#c9d1d9] border border-[#293652]">
                          Port {cs.port}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#07090f] text-[#8b949e] border border-[#1b2234]">
                          {cs.env}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-[#8b949e] mt-0.5">{cs.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b]">
                      {cs.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-[#8b949e]">
                  <span>Probe URL: <code className="text-[#58a6ff]">{cs.healthUrl}</code></span>
                  <span>Latency: <strong className="text-[#f0f6fc]">{cs.p99}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Connect Server Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0d111a] border border-[#1b2234] rounded-xl shadow-2xl overflow-hidden font-sans">
            <div className="bg-[#07090f] px-5 py-4 border-b border-[#1b2234] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server size={16} className="text-[#58a6ff]" />
                <h3 className="text-xs font-bold text-[#f0f6fc] font-mono">Connect Target Microservice / Server</h3>
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
                <label className="block text-[11px] font-mono text-[#8b949e] mb-1">Service Identifier</label>
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
                  <label className="block text-[11px] font-mono text-[#8b949e] mb-1">Host / Bind Address</label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="127.0.0.1"
                    className="w-full px-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-[#8b949e] mb-1">Production Port</label>
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
                  ProdPilot will immediately send an HTTP GET probe to verify status.
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-3 py-1.5 rounded bg-[#171f30] text-[#c9d1d9] text-xs font-mono hover:bg-[#1f293d]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectLoading}
                  className="px-4 py-1.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-mono font-medium flex items-center gap-1.5"
                >
                  {connectLoading ? <RotateCcw size={13} className="animate-spin" /> : <Check size={13} />}
                  <span>{connectLoading ? 'Testing Probe...' : 'Connect & Probe Server'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
