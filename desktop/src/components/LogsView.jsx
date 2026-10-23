import React, { useState } from 'react';
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

export default function LogsView({ incidents = [], activeIncident = null }) {
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [autoScroll, setAutoScroll] = useState(true);

  const sampleLogs = [
    { id: 1, time: '14:29:40', level: 'INFO', service: 'demo-prod', message: 'Worker 4: Booted process pid=99287 on port 8000' },
    { id: 2, time: '14:29:45', level: 'INFO', service: 'demo-prod', message: 'GET /health status=200 duration=0.8ms user_agent="ProdPilot-Watcher/1.0"' },
    { id: 3, time: '14:29:50', level: 'INFO', service: 'demo-prod', message: 'GET /orders status=200 duration=2.1ms user_agent="Mozilla/5.0"' },
    { id: 4, time: '14:29:55', level: 'INFO', service: 'demo-prod', message: 'GET /health status=200 duration=0.7ms user_agent="ProdPilot-Watcher/1.0"' },
    { id: 5, time: '14:29:58', level: 'INFO', service: 'demo-prod', message: 'POST /orders payload={"items": [{"id": "p1", "qty": 2, "price": 25.0}]}' },
    { id: 6, time: '14:29:59', level: 'ERROR', service: 'demo-prod', message: "KeyError: 'discount' in /orders (app.py:45 calculate_order)" },
    { id: 7, time: '14:29:59', level: 'ERROR', service: 'demo-prod', message: 'Traceback: File "app.py", line 45, in calculate_order: discount = order["discount"]' },
    { id: 8, time: '14:30:00', level: 'WARN', service: 'demo-prod', message: 'Healthcheck probe failed: 500 Internal Server Error (retrying in 5s)' },
    { id: 9, time: '14:30:01', level: 'INFO', service: 'prodpilot-core', message: 'FastRuleFilter: Classified log anomaly as SEV-1 HIGH. Fingerprint=e7f82b... Recurrence=1' },
    { id: 10, time: '14:30:02', level: 'INFO', service: 'prodpilot-core', message: 'TelegramNotifier: Immediate alert card dispatched to @prodpilotbot with Render web link' },
    { id: 11, time: '14:30:03', level: 'INFO', service: 'antigravity-agent', message: 'GitBlameAnalyzer: Suspect commit identified a1b2c3d ("feat: add discount support") author="Vishnu Nandan"' },
    { id: 12, time: '14:30:05', level: 'INFO', service: 'antigravity-agent', message: 'Worktree isolation created at /tmp/prodpilot-worktree-inc-001. Synthesizing test_repro.py' },
    { id: 13, time: '14:30:08', level: 'INFO', service: 'antigravity-agent', message: 'Reproduction test verified RED (KeyError). Patch applied. Verification GREEN (5 passed).' },
    { id: 14, time: '14:30:10', level: 'INFO', service: 'prodpilot-core', message: 'CanaryStaging: Fix-forward Canary running on Port 8001 (Health: 200 OK)' },
    { id: 15, time: '14:30:11', level: 'INFO', service: 'prodpilot-core', message: 'CanaryStaging: Rollback Canary running on Port 8002 (Health: 200 OK)' },
    { id: 16, time: '14:30:12', level: 'WARN', service: 'orchestrator', message: 'Incident transitioned to AWAITING_APPROVAL. Developer decision required.' }
  ];

  const filteredLogs = sampleLogs.filter((log) => {
    if (filterLevel !== 'ALL' && log.level !== filterLevel) return false;
    if (serviceFilter !== 'ALL' && log.service !== serviceFilter) return false;
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      return log.message.toLowerCase().includes(q) || log.service.toLowerCase().includes(q);
    }
    return true;
  });

  const getLevelStyle = (level) => {
    switch (level) {
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

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-hidden font-sans">
      {/* Top Header & Search Controls */}
      <div className="border-b border-[#1b2234] bg-[#0d111a] px-5 py-3 flex-shrink-0 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Terminal size={15} className="text-[#58a6ff]" />
            <div>
              <h1 className="text-sm font-semibold text-[#f0f6fc] tracking-tight">
                Live Telemetry & Logs Explorer
              </h1>
              <p className="text-[11px] text-[#6e7681] font-mono">
                Real-time log tailing from Render Log API and Local Forwarder
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {}}
              className="px-2 py-1 rounded bg-[#161b26] hover:bg-[#212a3d] text-xs font-mono text-[#8b949e] hover:text-[#c9d1d9] flex items-center gap-1 border border-[#212a3d] transition"
              title="Export filtered logs as JSON"
            >
              <Download size={12} />
              <span>Export</span>
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
                      ? 'bg-[#1f293d] text-[#f0f6fc] border border-[#2e3d5b]'
                      : 'text-[#6e7681] hover:text-[#c9d1d9] border border-transparent'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            {/* Service selector */}
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="px-2 py-1 rounded bg-[#07090f] border border-[#1b2234] text-xs text-[#8b949e] font-mono focus:outline-none"
            >
              <option value="ALL">All Services</option>
              <option value="demo-prod">demo-prod (8000)</option>
              <option value="prodpilot-core">prodpilot-core (8765)</option>
              <option value="antigravity-agent">antigravity-agent</option>
              <option value="orchestrator">orchestrator</option>
            </select>
          </div>
        </div>
      </div>

      {/* Log Feed Table (High Density Datadog Style) */}
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5 bg-[#080b11]">
        {filteredLogs.length === 0 ? (
          <div className="p-6 text-center text-[#485263]">
            No logs match the current filter or search criteria.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`p-1.5 rounded flex items-start gap-2.5 transition hover:bg-[#0d121c] ${
                log.level === 'ERROR'
                  ? 'bg-[#140b0e] border-l-2 border-[#da3633]'
                  : log.level === 'WARN'
                  ? 'bg-[#120f08] border-l-2 border-[#d29922]'
                  : 'bg-transparent'
              }`}
            >
              <span className="text-[#485263] text-[10px] flex-shrink-0 select-none">
                {log.time}
              </span>
              <span
                className={`px-1 py-0.2 rounded text-[9px] font-bold border flex-shrink-0 select-none ${getLevelStyle(
                  log.level
                )}`}
              >
                {log.level}
              </span>
              <span className="text-[#58a6ff] text-[10px] flex-shrink-0 select-none">
                [{log.service}]
              </span>
              <span className="text-[#c9d1d9] text-[11px] break-all leading-normal">
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Log Stream Footer */}
      <div className="border-t border-[#1b2234] bg-[#0d111a] px-4 py-2 flex items-center justify-between text-[11px] font-mono text-[#6e7681] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span>{filteredLogs.length} events</span>
          <span>•</span>
          <span>Tail: /tmp/demo-prod.log</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-[#07090f] border-[#1b2234] text-[#388bfd] focus:ring-0"
            />
            <span className="text-[#8b949e]">Auto-scroll live</span>
          </label>
        </div>
      </div>
    </div>
  );
}
