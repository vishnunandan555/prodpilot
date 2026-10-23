import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Search,
  Filter,
  Download,
  Trash2,
  RefreshCw,
  Clock,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Info,
  ChevronDown
} from 'lucide-react';

export default function LogsView({ apiUrl = 'http://127.0.0.1:8765', incidents = [], activeIncident = null }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilter, setServiceFilter] = useState('ALL');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/logs`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.warn('Failed to fetch real logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [apiUrl]);

  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== 'ALL' && log.level?.toUpperCase() !== filterLevel) return false;
    if (serviceFilter !== 'ALL' && log.service !== serviceFilter) return false;
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

  const servicesList = Array.from(new Set(logs.map((l) => l.service).filter(Boolean)));

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `prodpilot-logs-${Date.now()}.json`);
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
            <Terminal size={15} className="text-[#58a6ff]" />
            <div>
              <h1 className="text-sm font-semibold text-[#f0f6fc] tracking-tight">
                Live Telemetry & Ingest Logs
              </h1>
              <p className="text-[11px] text-[#6e7681] font-mono">
                Real-time log tailing from POST /ingest and connected services
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={filteredLogs.length === 0}
              className="px-2 py-1 rounded bg-[#161b26] hover:bg-[#212a3d] text-xs font-mono text-[#8b949e] hover:text-[#c9d1d9] flex items-center gap-1 border border-[#212a3d] transition disabled:opacity-50"
              title="Export filtered logs as JSON"
            >
              <Download size={12} />
              <span>Export</span>
            </button>
            <button
              onClick={fetchLogs}
              className="p-1 rounded bg-[#161b26] hover:bg-[#212a3d] border border-[#212a3d] text-[#8b949e] hover:text-[#c9d1d9] transition"
              title="Refresh log stream"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#0d1e17] border border-[#1b3d2b] text-[#3fb950] text-[10px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />
              <span>STREAM ACTIVE</span>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#485263]" />
              <input
                type="text"
                placeholder="Search logs by keyword, regex, or traceback..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 rounded bg-[#07090f] border border-[#1b2234] text-xs text-[#c9d1d9] placeholder-[#485263] font-mono focus:outline-none focus:border-[#388bfd]"
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

            {/* Service filter */}
            {servicesList.length > 0 && (
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="px-2 py-1 rounded bg-[#07090f] border border-[#1b2234] text-xs font-mono text-[#c9d1d9] focus:outline-none"
              >
                <option value="ALL">All Services</option>
                {servicesList.map((svc) => (
                  <option key={svc} value={svc}>
                    {svc}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Log Feed */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1 bg-[#080b11]">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[#6e7681] space-y-2">
            <Terminal size={32} className="text-[#30363d]" />
            <p className="text-xs font-semibold text-[#8b949e]">No Telemetry Logs Recorded Yet</p>
            <p className="text-[11px] text-[#6e7681] max-w-md">
              ProdPilot is listening for incoming logs at <code className="text-[#58a6ff]">POST {apiUrl}/ingest</code>. Once your backend service or ChunkStream streams logs, they will appear here in real time.
            </p>
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={log.id || index}
              className="flex items-start gap-3 p-1.5 rounded hover:bg-[#0d111a] transition border border-transparent hover:border-[#1b2234]"
            >
              <span className="text-[#485263] text-[11px] flex-shrink-0 select-none">
                {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'LOG'}
              </span>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border flex-shrink-0 ${getLevelStyle(
                  log.level
                )}`}
              >
                {log.level || 'INFO'}
              </span>
              {log.service && (
                <span className="text-[#8b949e] text-[11px] flex-shrink-0 font-semibold">
                  [{log.service}]
                </span>
              )}
              <span className="text-[#c9d1d9] text-[11px] break-all flex-1">
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="border-t border-[#1b2234] bg-[#0d111a] px-4 py-1.5 flex items-center justify-between text-[10px] font-mono text-[#6e7681] flex-shrink-0">
        <span>Showing {filteredLogs.length} of {logs.length} entries</span>
        <span>Telemetry buffer: SQLite `service_logs`</span>
      </div>
    </div>
  );
}
