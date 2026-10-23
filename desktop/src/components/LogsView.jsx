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
  ChevronUp,
  Sparkles,
  Zap,
  ArrowRight,
  Bug
} from 'lucide-react';
import { LogStreamSkeleton } from './LoadingSkeleton';

export default function LogsView({
  apiUrl = 'http://127.0.0.1:8765',
  onNavigate,
  onSelectIncident,
  incidents = [],
  initialSearch = '',
}) {
  const [servers, setServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSilentRefreshing, setIsSilentRefreshing] = useState(false);
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState(initialSearch || '');
  const [errorMsg, setErrorMsg] = useState('');
  const [streamConnected, setStreamConnected] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [waking, setWaking] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState(null);

  useEffect(() => {
    if (initialSearch) {
      setSearchTerm(initialSearch);
    }
  }, [initialSearch]);

  // Autonomous Triage & Jev Decision states
  const [triageSummary, setTriageSummary] = useState(null);
  const [triaging, setTriaging] = useState(false);
  const [triageAlert, setTriageAlert] = useState(null);
  const [collapsedTracebacks, setCollapsedTracebacks] = useState({});

  // Auto-refresh cadence: 15s default (consumes 4 req/min of 30 quota, leaving 26 for manual refreshes)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(15);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(15);

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

  const activeIncident = incidents.find(
    (i) =>
      (i.service === currentServer?.name ||
        i.service === 'chunkstream' ||
        (currentServer && i.service?.toLowerCase().includes(currentServer.name?.toLowerCase()))) &&
      !['RESOLVED', 'DEPLOYED', 'ROLLED_BACK'].includes(i.status)
  );

  const resolvedIncident = incidents.find(
    (i) =>
      (i.service === currentServer?.name ||
        i.service === 'chunkstream' ||
        (currentServer && i.service?.toLowerCase().includes(currentServer.name?.toLowerCase()))) &&
      ['RESOLVED', 'DEPLOYED'].includes(i.status)
  );

  const matchingIncident = activeIncident;

  // Auto-trigger autonomous triage only for new, unhandled anomalies not already resolved
  useEffect(() => {
    if (
      triageSummary &&
      (triageSummary.is_crash || triageSummary.severity === 'HIGH') &&
      !triageSummary.already_resolved &&
      !activeIncident &&
      !resolvedIncident &&
      !triaging &&
      selectedServerId
    ) {
      handleTriggerTriage();
    }
  }, [triageSummary?.fingerprint, triageSummary?.already_resolved, activeIncident?.id, resolvedIncident?.id]);

  // Fetch live logs from Render REST API or local ingest
  const fetchLogs = async (silent = false, overrideServerId = null, force = false) => {
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
      const res = await fetch(`${apiUrl}/servers/${targetServerId}/logs?limit=150&force=${force ? 'true' : 'false'}`);
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
          if (data.triage_summary) {
            setTriageSummary(data.triage_summary);
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

  const handleTriggerTriage = async () => {
    const targetId = selectedServerIdRef.current;
    if (!targetId) return;
    setTriaging(true);
    setTriageAlert(null);
    try {
      const res = await fetch(`${apiUrl}/servers/${targetId}/triage-logs`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.ok && (data.incident_created || data.incident)) {
        setTriageAlert({
          type: 'success',
          title: data.incident_created
            ? 'Autonomous Incident Created & Evaluated by TypeSafe Jev'
            : 'Recurring Production Incident Logged',
          message:
            data.message ||
            `Incident ${data.incident?.id} evaluated by TypeSafe Jev (${
              data.decision?.confidence ? Math.round(data.decision.confidence * 100) : 98
            }% confidence). Dispatched Telegram alert & Antigravity fix synthesis.`,
          incident: data.incident,
        });
      } else {
        setTriageAlert({
          type: 'info',
          title: 'Triage Assessment Complete',
          message: data.message || 'No unhandled exception or high-severity anomaly detected in recent logs.',
        });
      }
    } catch (err) {
      setTriageAlert({
        type: 'error',
        title: 'Triage Trigger Failed',
        message: err.message || 'Error communicating with triage endpoint',
      });
    } finally {
      setTriaging(false);
    }
  };

  const toggleTraceback = (id) => {
    setCollapsedTracebacks((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
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
                <option value={15} className="bg-[#121824] text-[#f0f6fc]">Every 15s (Optimal - 4 req/min)</option>
                <option value={20} className="bg-[#121824] text-[#f0f6fc]">Every 20s (Conserve Quota - 3 req/min)</option>
                <option value={30} className="bg-[#121824] text-[#f0f6fc]">Every 30s (Conservative - 2 req/min)</option>
                <option value={60} className="bg-[#121824] text-[#f0f6fc]">Every 60s (Slow - 1 req/min)</option>
                <option value={0} className="bg-[#121824] text-[#8b949e]">Paused (Manual Only)</option>
              </select>
              {autoRefreshInterval > 0 && (
                <span className="text-[10px] font-mono text-[#58a6ff] ml-1">
                  ({secondsUntilRefresh}s)
                </span>
              )}
            </div>

            {/* Render API Quota Status with dynamic reset countdown */}
            {rateLimitInfo && (
              <div
                className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono transition ${
                  rateLimitInfo.remaining <= 5
                    ? 'bg-[#261317] border-[#ff4444]/40 text-[#ff7b72]'
                    : rateLimitInfo.remaining <= 10
                    ? 'bg-[#221a0d] border-[#d29922]/40 text-[#e3b341]'
                    : 'bg-[#121824] border-[#222f47]'
                }`}
                title={`Render API limit: ${rateLimitInfo.limit}/min on rolling 60s window. Window resets in ${rateLimitInfo.reset}s.`}
              >
                <span className="text-[#8b949e]">Quota:</span>
                <span
                  className={
                    rateLimitInfo.remaining <= 5
                      ? 'text-[#ff7b72] font-bold'
                      : rateLimitInfo.remaining <= 10
                      ? 'text-[#e3b341] font-bold'
                      : 'text-[#3fb950] font-bold'
                  }
                >
                  {rateLimitInfo.remaining}/{rateLimitInfo.limit}
                </span>
                <span className="text-[#6e7681]">
                  ({rateLimitInfo.reset || 0}s reset)
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

            <div className="flex items-center gap-2">
              <div
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition border ${
                  triaging
                    ? 'bg-[#2d1218] text-[#ff7b72] border-[#ff4444]/40'
                    : matchingIncident
                    ? 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]'
                    : 'bg-[#121929] text-[#58a6ff] border-[#1f6feb]/30'
                }`}
                title="Continuous autonomous log watcher and triage engine"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    triaging
                      ? 'bg-[#ff7b72] animate-ping'
                      : matchingIncident
                      ? 'bg-[#3fb950] animate-pulse'
                      : 'bg-[#58a6ff]'
                  }`}
                />
                <span>
                  {triaging
                    ? 'Auto-Triaging...'
                    : matchingIncident
                    ? 'Autonomous Fix Active'
                    : 'Autonomous Watcher Active'}
                </span>
              </div>
            </div>

            <button
              onClick={() => fetchLogs(false, selectedServerId, true)}
              disabled={loading}
              className="px-2.5 py-1.5 rounded-md bg-[#161b26] hover:bg-[#212a3d] border border-[#212a3d] text-xs font-medium text-[#8b949e] hover:text-[#c9d1d9] flex items-center gap-1.5 transition"
              title="Force refresh live log stream from Render"
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
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2.5 bg-[#080b11]">
        {/* Triage Action Alert Notification */}
        {triageAlert && (
          <div
            className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200 ${
              triageAlert.type === 'success'
                ? 'bg-[#0d1e17] border-[#3fb950]/40 text-[#3fb950]'
                : triageAlert.type === 'error'
                ? 'bg-[#241316] border-[#ff7b72]/40 text-[#ff7b72]'
                : 'bg-[#121929] border-[#58a6ff]/40 text-[#58a6ff]'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <Sparkles size={16} className="shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-xs">{triageAlert.title}</div>
                <div className="text-[11px] opacity-90 mt-0.5">{triageAlert.message}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {triageAlert.incident && onSelectIncident && (
                <button
                  onClick={() => onSelectIncident(triageAlert.incident)}
                  className="px-3 py-1.5 rounded bg-[#3fb950] hover:bg-[#2ea043] text-[#0d1117] font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
                >
                  <span>View Incident</span>
                  <ArrowRight size={13} />
                </button>
              )}
              <button
                onClick={() => setTriageAlert(null)}
                className="px-2 py-1 text-[11px] opacity-75 hover:opacity-100 transition"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Live Detected Anomaly / Crash Banner (Only shown if unhandled and not already resolved) */}
        {triageSummary &&
          (triageSummary.is_crash || triageSummary.severity === 'HIGH') &&
          !triageSummary.already_resolved &&
          !resolvedIncident && (
          <div className="p-3.5 rounded-lg bg-gradient-to-r from-[#2a1318] to-[#180d12] border border-[#ff4444]/40 text-xs shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#ff4444]/15 border border-[#ff4444]/30 flex items-center justify-center text-[#ff7b72] shrink-0">
                <AlertTriangle size={18} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[#f0f6fc] text-xs tracking-wide">
                    ANOMALY DETECTED IN RENDER LOG STREAM
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#ff4444]/20 text-[#ff7b72] border border-[#ff4444]/40">
                    {triageSummary.severity || 'HIGH'}
                  </span>
                </div>
                <p className="text-[11px] text-[#ff7b72] mt-0.5 font-mono">
                  {triageSummary.reason || 'Unhandled Python Traceback or Fatal Crash in Service'}
                </p>
                {triageSummary.suspected_area && (
                  <span className="text-[10px] text-[#8b949e]">
                    Suspected Area: <code className="text-[#a371f7]">{triageSummary.suspected_area}</code>
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {matchingIncident && onSelectIncident ? (
                <button
                  onClick={() => onSelectIncident(matchingIncident)}
                  className="px-3.5 py-1.5 rounded-md bg-[#238636] hover:bg-[#2ea043] active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition"
                >
                  <Sparkles size={13} className="text-[#fff]" />
                  <span>Inspect Autonomous Fix ({matchingIncident.id.slice(0, 14)}...) ➔</span>
                </button>
              ) : triaging ? (
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-[#2d1218] border border-[#ff4444]/40 text-[#ff7b72] text-xs font-mono font-semibold">
                  <Sparkles size={13} className="animate-spin text-[#ff7b72]" />
                  <span>Auto-Triaging with Jev & Isolating Worktree...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-[#0d1e17] border border-[#1b3d2b] text-[#3fb950] text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-[#3fb950] animate-pulse" />
                  <span>Auto-Triage Dispatched</span>
                </div>
              )}
            </div>
          </div>
        )}

        {isSuspended && (
          <div className="p-3 mb-2 rounded-lg bg-[#1c180e] border border-[#3b2e13] text-xs text-[#e3b341] flex items-center justify-between gap-3">
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
          <div className="p-3 mb-2 rounded-lg bg-[#241316] border border-[#481c25] text-xs text-[#ff7b72] flex items-center gap-2">
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
          filteredLogs.map((log, idx) => {
            const logKey = log.id || `log-${idx}`;

            // SPECIALIZED SENTRY-GRADE TRACEBACK CARD
            if (log.is_traceback) {
              const isCollapsed = !!collapsedTracebacks[logKey];
              return (
                <div
                  key={logKey}
                  className="rounded-lg bg-[#150a0e] border border-[#ff4444]/40 shadow-sm overflow-hidden transition-all duration-200"
                >
                  {/* Traceback Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 bg-[#200e14] border-b border-[#ff4444]/25">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#ff4444]/20 text-[#ff7b72] border border-[#ff4444]/40 flex items-center gap-1">
                        <Bug size={11} />
                        TRACEBACK (CRITICAL)
                      </span>
                      <span className="text-[#f0f6fc] font-bold text-xs font-mono">
                        {log.error_summary || 'Python Exception'}
                      </span>
                      {log.service && (
                        <span className="text-[#a371f7] text-[10px] font-semibold">
                          [{log.service}]
                        </span>
                      )}
                      <span className="text-[#8b949e] text-[10px] font-mono">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'LIVE'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {matchingIncident && onSelectIncident ? (
                        <button
                          onClick={() => onSelectIncident(matchingIncident)}
                          className="px-2.5 py-1 rounded bg-[#238636]/25 hover:bg-[#238636]/40 border border-[#238636]/50 text-[#3fb950] hover:text-[#fff] text-[11px] font-semibold flex items-center gap-1 transition"
                          title="Open linked incident"
                        >
                          <Sparkles size={11} />
                          <span>View Incident ➔</span>
                        </button>
                      ) : (
                        <button
                          onClick={handleTriggerTriage}
                          disabled={triaging}
                          className="px-2.5 py-1 rounded bg-[#ff4444]/20 hover:bg-[#ff4444]/30 border border-[#ff4444]/50 text-[#ff7b72] hover:text-[#fff] text-[11px] font-semibold flex items-center gap-1 transition"
                          title="Triage this traceback with TypeSafe Jev"
                        >
                          <Sparkles size={11} className={triaging ? 'animate-spin' : ''} />
                          <span>{triaging ? 'Auto-Triaging...' : 'Triage Incident'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => toggleTraceback(logKey)}
                        className="p-1 rounded bg-[#2d1218] hover:bg-[#3d1822] text-[#8b949e] hover:text-[#f0f6fc] border border-[#4a1c24] transition text-xs flex items-center gap-1"
                        title={isCollapsed ? 'Expand stack trace' : 'Collapse stack trace'}
                      >
                        {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                        <span className="text-[10px] hidden sm:inline">
                          {isCollapsed ? 'Expand' : 'Collapse'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Traceback Body */}
                  {!isCollapsed ? (
                    <div className="p-3 bg-[#070910] text-[#ffa198] text-[11px] font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap select-text">
                      {log.message}
                    </div>
                  ) : (
                    <div
                      onClick={() => toggleTraceback(logKey)}
                      className="px-3.5 py-2 bg-[#070910] text-[#6e7681] text-[11px] font-mono cursor-pointer hover:text-[#8b949e] transition flex items-center justify-between"
                    >
                      <span>{log.message.split('\n')[0]} ... (click to expand full traceback)</span>
                      <span className="text-[10px] text-[#485263]">
                        {log.message.split('\n').length} frames
                      </span>
                    </div>
                  )}
                </div>
              );
            }

            // STANDARD CONTAINER LOG ROW
            return (
              <div
                key={logKey}
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
            );
          })
        )}
      </div>
    </div>
  );
}
