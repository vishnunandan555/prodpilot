import React, { useState, useEffect, useRef } from 'react';
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
  ShieldAlert,
  SlidersHorizontal,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { LogStreamSkeleton } from './LoadingSkeleton';

export default function LogsView({ apiUrl = 'http://127.0.0.1:8765', onNavigate }) {
  const [servers, setServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSilentRefreshing, setIsSilentRefreshing] = useState(false);
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [streamConnected, setStreamConnected] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [waking, setWaking] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState(null);

  // Auto-refresh cadence: 10 seconds default, can be 5, 10, 30, or 0 (off)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(10);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(10);

  // Use refs to avoid closure staleness in intervals
  const selectedServerIdRef = useRef(selectedServerId);
  const serversRef = useRef(servers);
  const autoRefreshIntervalRef = useRef(autoRefreshInterval);

  useEffect(() => {
    selectedServerIdRef.current = selectedServerId;
  }, [selectedServerId]);

  useEffect(() => {
    serversRef.current = servers;
  }, [servers]);

  useEffect(() => {
    autoRefreshIntervalRef.current = autoRefreshInterval;
    setSecondsUntilRefresh(autoRefreshInterval);
  }, [autoRefreshInterval]);

  // Fetch registered servers
  const fetchServers = async () => {
    try {
      const res = await fetch(`${apiUrl}/servers`);
      if (res.ok) {
        const data = await res.json();
        const serverList = data.servers || [];
        setServers(serverList);
        serversRef.current = serverList;

        if (serverList.length > 0) {
          const currentId = selectedServerIdRef.current;
          const match = serverList.find((s) => s.id === currentId);
          if (!match) {
            const active = data.active_server || serverList[0];
            setSelectedServerId(active.id);
            selectedServerIdRef.current = active.id;
            fetchLogs(false, active.id);
          }
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
  const fetchLogs = async (silent = false, overrideServerId = null) => {
    const targetServerId = overrideServerId || selectedServerIdRef.current;
    const targetServer = serversRef.current.find((s) => s.id === targetServerId) || currentServer;

    if (!targetServerId) {
      // Fallback: check general /logs
      try {
        if (!silent) setLoading(true);
        const res = await fetch(`${apiUrl}/logs`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
          setStreamConnected(data.logs && data.logs.length > 0);
          setErrorMsg('');
        }
      } catch (err) {
        setStreamConnected(false);
      } finally {
        if (!silent) setLoading(false);
      }
      return;
    }

    if (silent) {
      setIsSilentRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetch(`${apiUrl}/servers/${targetServerId}/logs?limit=150`);
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
          if (data.rate_limit) {
            setRateLimitInfo(data.rate_limit);
          }
        }
      } else {
        setStreamConnected(false);
        setErrorMsg(`Render logs request failed: HTTP ${res.status}`);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error querying server logs');
      setStreamConnected(false);
    } finally {
      if (silent) {
        setIsSilentRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleWakeServer = async () => {
    if (!currentServer?.id) return;
    setWaking(true);
    try {
      await fetch(`${apiUrl}/servers/${currentServer.id}/probe`, { method: 'POST' });
      await fetchLogs(false, currentServer.id);
      await fetchServers();
    } catch (e) {
      console.warn('Wake attempt pinged endpoint:', e);
    } finally {
      setWaking(false);
    }
  };

  // Initial load whenever server selection changes
  useEffect(() => {
    if (selectedServerId) {
      fetchLogs(false, selectedServerId);
    }
  }, [selectedServerId, apiUrl]);

  // Master countdown and auto-refresh timer loop (1 second ticks)
  useEffect(() => {
    const timer = setInterval(() => {
      const intervalSec = autoRefreshIntervalRef.current;
      if (intervalSec <= 0) return; // Auto-refresh paused

      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          // Trigger silent background log refresh
          fetchLogs(true, selectedServerIdRef.current);
          return intervalSec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [apiUrl]);

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
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#161f30] border border-[#263550] flex items-center justify-center text-[#58a6ff]">
              <Terminal size={16} />
            </div>
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
                <span className="text-[11px] font-mono text-[#8b949e]">
                  ({filteredLogs.length} events)
                </span>
              </div>
              <p className="text-xs text-[#8b949e] mt-0.5">
                Real-time container stdout/stderr, stack traces, and Render lifecycle events
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {servers.length > 0 && (
              <select
                value={selectedServerId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedServerId(val);
                  selectedServerIdRef.current = val;
                  fetchLogs(false, val);
                }}
                className="bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-2.5 py-1.5 rounded-md focus:outline-none focus:border-[#58a6ff]"
              >
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status})
                  </option>
                ))}
              </select>
            )}

            {/* Auto-Refresh Cadence Selector with Live Pulse */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#121824] border border-[#222f47] text-xs">
              <Clock size={12} className={autoRefreshInterval > 0 ? 'text-[#3fb950]' : 'text-[#6e7681]'} />
              <span className="text-[11px] text-[#8b949e]">Auto:</span>
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                className="bg-transparent text-[11px] font-semibold text-[#f0f6fc] focus:outline-none cursor-pointer"
              >
                <option value={3} className="bg-[#121824] text-[#f0f6fc]">Every 3s (High-Frequency)</option>
                <option value={5} className="bg-[#121824] text-[#f0f6fc]">Every 5s (Optimal)</option>
                <option value={10} className="bg-[#121824] text-[#f0f6fc]">Every 10s (Default)</option>
                <option value={30} className="bg-[#121824] text-[#f0f6fc]">Every 30s</option>
                <option value={0} className="bg-[#121824] text-[#8b949e]">Paused</option>
              </select>
              {autoRefreshInterval > 0 && (
                <span className="text-[10px] font-mono text-[#58a6ff] ml-1">
                  ({secondsUntilRefresh}s)
                </span>
              )}
            </div>

            {/* Render API Quota Status */}
            {rateLimitInfo && (
              <div
                className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded bg-[#121824] border border-[#222f47] text-[10px] font-mono"
                title={`Render API limit: ${rateLimitInfo.limit}/min. Resets in ${rateLimitInfo.reset}s`}
              >
                <span className="text-[#8b949e]">Quota:</span>
                <span
                  className={
                    rateLimitInfo.remaining < 5
                      ? 'text-[#ff7b72] font-bold'
                      : 'text-[#3fb950] font-bold'
                  }
                >
                  {rateLimitInfo.remaining}/{rateLimitInfo.limit}
                </span>
              </div>
            )}

            <button
              onClick={handleExport}
              disabled={filteredLogs.length === 0}
              className="px-2.5 py-1.5 rounded-md bg-[#161b26] hover:bg-[#212a3d] text-xs font-medium text-[#8b949e] hover:text-[#c9d1d9] flex items-center gap-1.5 border border-[#212a3d] transition disabled:opacity-50"
              title="Export filtered logs as JSON"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              onClick={() => fetchLogs(false, selectedServerId)}
              disabled={loading}
              className="px-2.5 py-1.5 rounded-md bg-[#161b26] hover:bg-[#212a3d] border border-[#212a3d] text-xs font-medium text-[#8b949e] hover:text-[#c9d1d9] flex items-center gap-1.5 transition"
              title="Refresh log stream now"
            >
              <RefreshCw
                size={13}
                className={loading || isSilentRefreshing ? 'animate-spin text-[#58a6ff]' : ''}
              />
              <span>Refresh</span>
            </button>

            {/* Real Stream Status indicator: Never fake active! */}
            {streamConnected ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#0d1e17] border border-[#1b3d2b] text-[#3fb950] text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse" />
                <span>LIVE STREAM</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#161b26] border border-[#212a3d] text-[#8b949e] text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6e7681]" />
                <span>DISCONNECTED</span>
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
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-[11px] text-[#8b949e] hover:text-[#f0f6fc] px-1"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Level Chips */}
            <div className="flex items-center bg-[#07090f] p-0.5 rounded border border-[#1b2234] text-xs font-mono">
              {['ALL', 'ERROR', 'WARN', 'INFO'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setFilterLevel(lvl)}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-semibold transition ${
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

        {loading && logs.length === 0 ? (
          <div className="p-3 space-y-2 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-xs text-[#58a6ff] pb-2">
              <RefreshCw size={13} className="animate-spin" />
              <span>Connecting and querying server telemetry...</span>
            </div>
            <LogStreamSkeleton count={9} />
          </div>
        ) : filteredLogs.length === 0 ? (
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
              <span className="text-[#485263] select-none text-[11px] min-w-[70px] shrink-0 font-mono">
                {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'LIVE'}
              </span>

              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-bold border uppercase shrink-0 ${getLevelStyle(
                  log.level
                )}`}
              >
                {log.level || 'INFO'}
              </span>

              {log.service && (
                <span className="text-[#a371f7] text-[11px] font-semibold min-w-[85px] shrink-0">
                  [{log.service}]
                </span>
              )}

              <span className="text-[#c9d1d9] flex-1 break-all select-text font-mono leading-relaxed whitespace-pre-wrap">
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
