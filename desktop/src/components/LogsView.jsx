import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Search,
  Download,
  RefreshCw,
  Clock,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Server,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';

export default function LogsView({ apiUrl = 'http://127.0.0.1:8765', onNavigate }) {
  const [servers, setServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [streamConnected, setStreamConnected] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [waking, setWaking] = useState(false);

  // Fetch registered servers
  const fetchServers = async () => {
    try {
      const res = await fetch(`${apiUrl}/servers`);
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers || []);
        if (!selectedServerId && data.servers?.length > 0) {
          const active = data.active_server || data.servers[0];
          setSelectedServerId(active.id);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch servers for logs:', e);
    }
  };

  useEffect(() => {
    fetchServers();
  }, [apiUrl]);

  const currentServer = servers.find((s) => s.id === selectedServerId);

  // Fetch live logs from Render REST API or local ingest
  const fetchLogs = async () => {
    if (!currentServer?.id) {
      // Fallback: check general /logs
      try {
        const res = await fetch(`${apiUrl}/logs`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
          setStreamConnected(data.logs && data.logs.length > 0);
        }
      } catch (err) {
        setStreamConnected(false);
      }
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/servers/${currentServer.id}/logs`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok === false) {
          setErrorMsg(data.error || 'Failed to fetch logs from Render');
          setLogs([]);
          setStreamConnected(false);
          setIsSuspended(false);
        } else {
          setLogs(data.logs || []);
          setStreamConnected(true);
          setErrorMsg('');
          setIsSuspended(!!data.is_suspended);
        }
      } else {
        setStreamConnected(false);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error querying server logs');
      setStreamConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleWakeServer = async () => {
    if (!currentServer?.id) return;
    setWaking(true);
    try {
      await fetch(`${apiUrl}/servers/${currentServer.id}/probe`, { method: 'POST' });
      await fetchLogs();
      await fetchServers();
    } catch (e) {
      console.warn('Wake attempt pinged endpoint:', e);
    } finally {
      setWaking(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [selectedServerId, apiUrl]);

  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== 'ALL' && log.level?.toUpperCase() !== filterLevel) return false;
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      return (
        (log.message || '').toLowerCase().includes(q) ||
        (log.service || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getLevelStyle = (level) => {
    switch (level?.toUpperCase()) {
      case 'ERROR':
        return 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]';
      case 'WARN':
        return 'bg-[#1c180e] text-[#e3b341] border-[#3b2e13]';
      case 'INFO':
        return 'bg-[#121929] text-[#58a6ff] border-[#1d2d47]';
      default:
        return 'bg-[#161b26] text-[#8b949e] border-[#212a3d]';
    }
  };

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `render-logs-${currentServer?.name || 'prod'}-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-hidden font-sans">
      {/* Top Header & Search Controls */}
      <div className="border-b border-[#1b2234] bg-[#0d111a] px-5 py-3 flex-shrink-0 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-[#58a6ff]" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-[#f0f6fc] tracking-tight">
                  Logs Explorer
                </h1>
                {currentServer?.name ? (
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-[#161f30] text-[#79c0ff] border border-[#263550]">
                    {currentServer.name}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-[#8b949e] mt-0.5">
                Real-time deployment lifecycle events, container builds & live health telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {servers.length > 0 && (
              <select
                value={selectedServerId || ''}
                onChange={(e) => setSelectedServerId(e.target.value)}
                className="bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-2.5 py-1 rounded-md focus:outline-none"
              >
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status})
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handleExport}
              disabled={filteredLogs.length === 0}
              className="px-2.5 py-1 rounded-md bg-[#161b26] hover:bg-[#212a3d] text-xs font-medium text-[#8b949e] hover:text-[#c9d1d9] flex items-center gap-1.5 border border-[#212a3d] transition disabled:opacity-50"
              title="Export filtered logs as JSON"
            >
              <Download size={13} />
              <span>Export</span>
            </button>

            <button
              onClick={fetchLogs}
              disabled={loading}
              className="px-2.5 py-1 rounded-md bg-[#161b26] hover:bg-[#212a3d] border border-[#212a3d] text-xs font-medium text-[#8b949e] hover:text-[#c9d1d9] flex items-center gap-1.5 transition"
              title="Refresh log stream"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-[#58a6ff]' : ''} />
              <span>Refresh Logs</span>
            </button>

            {/* Real Stream Status indicator: Never fake active! */}
            {streamConnected ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#0d1e17] border border-[#1b3d2b] text-[#3fb950] text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse" />
                <span>TELEMETRY STREAM LIVE</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#161b26] border border-[#212a3d] text-[#8b949e] text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6e7681]" />
                <span>NOT CONNECTED</span>
              </div>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#485263]" />
              <input
                type="text"
                placeholder="Search logs by keyword, exception, or traceback..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 rounded-md bg-[#07090f] border border-[#1b2234] text-xs text-[#c9d1d9] placeholder-[#485263] focus:outline-none focus:border-[#388bfd]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Level Chips */}
            <div className="flex items-center bg-[#07090f] p-0.5 rounded border border-[#1b2234] text-xs font-mono">
              {['ALL', 'ERROR', 'WARN', 'INFO'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setFilterLevel(lvl)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                    filterLevel === lvl
                      ? 'bg-[#1b2234] text-[#f0f6fc]'
                      : 'text-[#6e7681] hover:text-[#c9d1d9]'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Log Feed */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5 bg-[#080b11]">
        {isSuspended && (
          <div className="p-3 mb-3 rounded-lg bg-[#1c180e] border border-[#3b2e13] text-xs text-[#e3b341] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-[#e3b341]" />
              <span>
                <strong>Service in Standby:</strong> '{currentServer?.name}' is spun down on Render (free-tier inactivity). It will auto-wake upon incoming requests.
              </span>
            </div>
            <button
              onClick={handleWakeServer}
              disabled={waking}
              className="px-3 py-1 rounded bg-[#e3b341] hover:bg-[#d29922] text-[#0d1117] font-bold text-[11px] transition shrink-0"
            >
              {waking ? 'Waking Server...' : 'Wake Server Now'}
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 mb-3 rounded-lg bg-[#241316] border border-[#481c25] text-xs text-[#ff7b72] flex items-center gap-2">
            <ShieldAlert size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[#6e7681] space-y-3">
            <Terminal size={36} className="text-[#2b354b]" />
            <div>
              <p className="text-xs text-[#8b949e] font-semibold">
                {!currentServer
                  ? 'No Production Servers Connected'
                  : !currentServer.render_service_id
                  ? 'No Render Service ID Attached'
                  : 'Awaiting Real Render Production Logs'}
              </p>
              <p className="text-[11px] text-[#6e7681] mt-1 max-w-sm">
                {!currentServer
                  ? 'Go to Production Servers tab to attach your Render web service and configure your Render API Key.'
                  : !currentServer.render_service_id
                  ? `Attach Render Service ID (srv-...) to '${currentServer.name}' to stream real production logs.`
                  : 'No log events matching filters or container has not emitted standard output.'}
              </p>
            </div>
          </div>
        ) : (
          filteredLogs.map((log, idx) => (
            <div
              key={log.id || idx}
              className="group flex items-start gap-3 px-3 py-2 rounded bg-[#0d111a]/70 hover:bg-[#121824] border border-[#1b2234]/50 transition"
            >
              <span className="text-[#485263] select-none text-[11px] min-w-[70px]">
                {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'LIVE'}
              </span>

              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-bold border uppercase ${getLevelStyle(
                  log.level
                )}`}
              >
                {log.level || 'INFO'}
              </span>

              {log.service && (
                <span className="text-[#a371f7] text-[11px] font-semibold min-w-[90px]">
                  [{log.service}]
                </span>
              )}

              <span className="text-[#c9d1d9] flex-1 break-all select-text font-mono leading-relaxed">
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
