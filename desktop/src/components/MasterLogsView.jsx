import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Activity,
  Search,
  Filter,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Bot,
  Zap,
  Play,
  FileCode,
  FileText,
  ShieldAlert,
  Server,
  Layers,
  Clock,
  ArrowUpRight
} from 'lucide-react';

export default function MasterLogsView({ apiUrl, onNavigate, onSelectIncident }) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedLogIds, setExpandedLogIds] = useState(new Set());
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const fetchMasterLogs = async (isManual = false) => {
    if (isManual) setIsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/platform/master-logs?limit=250`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.warn('Failed to fetch master logs:', err);
    } finally {
      if (isManual) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterLogs(true);
  }, [apiUrl]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchMasterLogs(false);
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh, apiUrl]);

  const toggleExpand = (id) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedLogIds(new Set(logs.map((l) => l.id)));
  };

  const collapseAll = () => {
    setExpandedLogIds(new Set());
  };

  const handleCopyAll = () => {
    const text = JSON.stringify(logs, null, 2);
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopyEntry = (entry, idx) => {
    navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Filter logs by search keyword and category
  const filteredLogs = logs.filter((l) => {
    const kind = (l.kind || '').toLowerCase();
    const stage = (l.stage || '').toLowerCase();
    const payloadStr = typeof l.payload === 'string' ? l.payload : JSON.stringify(l.payload || {});
    const combined = `${l.incident_id || ''} ${l.service || ''} ${stage} ${kind} ${payloadStr}`.toLowerCase();

    if (searchTerm && !combined.includes(searchTerm.toLowerCase())) {
      return false;
    }

    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'thoughts') return kind.includes('thought') || stage === 'understand';
    if (categoryFilter === 'tools') return kind.includes('tool') || kind.includes('command') || kind.includes('read') || kind.includes('write');
    if (categoryFilter === 'verifier') return kind.includes('test') || stage === 'verify';
    if (categoryFilter === 'anomalies') return kind.includes('anomaly') || kind.includes('crash') || l.severity === 'HIGH';
    if (categoryFilter === 'canary') return stage === 'stage' || stage === 'deploy' || kind.includes('canary') || kind.includes('resolved');
    return true;
  });

  const getLogSubsystemBadge = (log) => {
    const kind = (log.kind || '').toLowerCase();
    const stage = (log.stage || '').toLowerCase();

    if (kind.includes('tool') || kind.includes('thought')) {
      return {
        label: 'ANTIGRAVITY AGENT',
        color: 'bg-[#1c122c] text-[#d2a8ff] border-[#3e2363]',
        icon: Bot,
      };
    }
    if (kind.includes('test') || stage === 'verify') {
      return {
        label: 'TEST VERIFIER',
        color: 'bg-[#0f1f1d] text-[#3fb950] border-[#1d4638]',
        icon: Play,
      };
    }
    if (kind.includes('recurrent') || kind.includes('anomaly') || stage === 'understand') {
      return {
        label: 'WATCHDOG',
        color: 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]',
        icon: AlertTriangle,
      };
    }
    if (stage === 'deploy' || stage === 'stage') {
      return {
        label: 'CANARY PIPELINE',
        color: 'bg-[#0e1f2f] text-[#58a6ff] border-[#1b3d63]',
        icon: Server,
      };
    }
    return {
      label: 'SYSTEM',
      color: 'bg-[#161b22] text-[#8b949e] border-[#30363d]',
      icon: Terminal,
    };
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] font-sans overflow-hidden">
      {/* Header Bar */}
      <div className="px-6 py-4 bg-[#0d111a] border-b border-[#1b2234] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#161f30] border border-[#2b3a58] flex items-center justify-center text-[#58a6ff]">
              <Terminal size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#f0f6fc] tracking-tight">Platform Master Execution Log</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#161f30] text-[#58a6ff] border border-[#2b3a58] font-semibold">
                  AUDIT STREAM
                </span>
              </div>
              <p className="text-xs text-[#8b949e] mt-0.5">
                Unified live feed of agent monologue, tool calls, bash commands, tests, watchdog probes & state transitions.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition ${
              autoRefresh
                ? 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]'
                : 'bg-[#161b22] text-[#8b949e] border-[#30363d]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-[#3fb950] animate-pulse' : 'bg-[#6e7681]'}`} />
            <span>{autoRefresh ? 'Live Auto-Stream' : 'Paused'}</span>
          </button>

          <button
            onClick={() => fetchMasterLogs(true)}
            className="p-1.5 rounded-lg bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] text-[#c9d1d9] text-xs transition"
            title="Refresh now"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-[#58a6ff]' : ''} />
          </button>

          <button
            onClick={handleCopyAll}
            className="px-3 py-1.5 rounded-lg bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] text-xs font-semibold text-[#c9d1d9] flex items-center gap-1.5 transition"
          >
            {copiedAll ? <Check size={13} className="text-[#3fb950]" /> : <Copy size={13} />}
            <span>{copiedAll ? 'Copied' : 'Copy All'}</span>
          </button>

          <button
            onClick={expandedLogIds.size === logs.length ? collapseAll : expandAll}
            className="px-3 py-1.5 rounded-lg bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] text-xs font-semibold text-[#c9d1d9] flex items-center gap-1.5 transition"
          >
            {expandedLogIds.size === logs.length ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            <span>{expandedLogIds.size === logs.length ? 'Collapse All' : 'Expand All'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 py-2.5 bg-[#0a0e17] border-b border-[#1b2234] flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={13} className="absolute left-3 top-2.5 text-[#6e7681]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search commands, thoughts, file paths, incident IDs..."
            className="w-full bg-[#05070a] border border-[#1b2234] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#c9d1d9] placeholder-[#6e7681] focus:outline-none focus:border-[#58a6ff]"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          {[
            { id: 'all', label: 'All Events', count: logs.length },
            { id: 'thoughts', label: 'Agent Thoughts', count: logs.filter((l) => (l.kind || '').includes('thought') || l.stage === 'UNDERSTAND').length },
            { id: 'tools', label: 'Tools & Commands', count: logs.filter((l) => (l.kind || '').includes('tool') || (l.kind || '').includes('command')).length },
            { id: 'verifier', label: 'Pytest Verifier', count: logs.filter((l) => (l.kind || '').includes('test') || l.stage === 'VERIFY').length },
            { id: 'anomalies', label: 'Watchdog Crashes', count: logs.filter((l) => (l.kind || '').includes('anomaly') || l.severity === 'HIGH').length },
            { id: 'canary', label: 'Canary & Deploys', count: logs.filter((l) => l.stage === 'STAGE' || l.stage === 'DEPLOY' || (l.kind || '').includes('resolved')).length },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition flex items-center gap-1.5 ${
                categoryFilter === cat.id
                  ? 'bg-[#1f6feb] text-white shadow-xs'
                  : 'bg-[#121824] hover:bg-[#1b2334] text-[#8b949e] border border-[#1b2234]'
              }`}
            >
              <span>{cat.label}</span>
              <span className="text-[10px] font-mono opacity-80">({cat.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Stream Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-2 font-mono text-xs">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-[#6e7681] space-y-3">
            <Terminal size={32} className="mx-auto text-[#30363d]" />
            <p className="text-sm">No platform events matched the selected filter.</p>
            <button
              onClick={() => { setSearchTerm(''); setCategoryFilter('all'); }}
              className="text-xs text-[#58a6ff] hover:underline"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredLogs.map((log, idx) => {
            const isExpanded = expandedLogIds.has(log.id);
            const badge = getLogSubsystemBadge(log);
            const SubsystemIcon = badge.icon;
            const payload = log.payload || {};

            // Extract primary message or summary
            let headline = payload.message || payload.summary || payload.error || '';
            if (!headline && payload.thought) headline = payload.thought;
            if (!headline && payload.tool) headline = `Tool: ${payload.tool}`;

            // Extract command line or specific action
            const commandLine = payload.parameters?.CommandLine || payload.args?.CommandLine || payload.command;
            const filePath = payload.parameters?.Path || payload.parameters?.TargetFile || payload.path;

            const timeStr = log.ts ? new Date(log.ts).toLocaleTimeString() : 'N/A';

            return (
              <div
                key={log.id || idx}
                className={`rounded-lg border transition ${
                  isExpanded ? 'bg-[#0a0e17] border-[#2b3a58]' : 'bg-[#0a0e17]/60 hover:bg-[#0d121e] border-[#1b2234]'
                }`}
              >
                {/* Row Header */}
                <div
                  onClick={() => toggleExpand(log.id)}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Timestamp */}
                    <span className="text-[11px] text-[#6e7681] flex-shrink-0 font-mono">
                      {timeStr}
                    </span>

                    {/* Subsystem Badge */}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-tight border flex items-center gap-1 flex-shrink-0 ${badge.color}`}>
                      <SubsystemIcon size={11} />
                      <span>{badge.label}</span>
                    </span>

                    {/* Stage Tag */}
                    {log.stage && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#121620] text-[#8b949e] border border-[#21262d] flex-shrink-0">
                        {log.stage}
                      </span>
                    )}

                    {/* Incident Reference Link */}
                    {log.incident_id && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectIncident) {
                            onSelectIncident({ id: log.incident_id, service: log.service });
                          }
                          if (onNavigate) onNavigate('incidents');
                        }}
                        className="text-[10px] font-bold text-[#58a6ff] hover:underline flex items-center gap-0.5 flex-shrink-0 cursor-pointer"
                        title="Click to jump to incident"
                      >
                        <span>{log.incident_id}</span>
                        <ArrowUpRight size={10} />
                      </span>
                    )}

                    {/* Main Headline / Message */}
                    <span className="text-xs text-[#f0f6fc] truncate font-medium flex-1">
                      {commandLine ? (
                        <span className="text-[#3fb950] font-bold">$ {commandLine}</span>
                      ) : headline ? (
                        headline
                      ) : (
                        <span className="text-[#8b949e] italic">Event {log.kind} recorded</span>
                      )}
                    </span>
                  </div>

                  {/* Right Status & Expand Toggle */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {log.kind && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-[#161b22] text-[#8b949e] border border-[#21262d]">
                        {log.kind}
                      </span>
                    )}

                    {isExpanded ? (
                      <ChevronUp size={14} className="text-[#8b949e]" />
                    ) : (
                      <ChevronDown size={14} className="text-[#8b949e]" />
                    )}
                  </div>
                </div>

                {/* Expanded Detail Panel */}
                {isExpanded && (
                  <div className="px-4 py-3 bg-[#05070a] border-t border-[#1b2234] space-y-2.5 text-xs">
                    {/* Command Line Box */}
                    {commandLine && (
                      <div>
                        <span className="text-[10px] font-bold uppercase text-[#6e7681] block mb-1">
                          Terminal Command Line:
                        </span>
                        <div className="p-2 rounded bg-[#07090f] border border-[#1b263b] text-[#3fb950] font-mono whitespace-pre-wrap">
                          $ {commandLine}
                        </div>
                      </div>
                    )}

                    {/* Target File */}
                    {filePath && (
                      <div className="text-[11px] text-[#8b949e]">
                        <span className="font-bold text-[#6e7681]">Target File: </span>
                        <code className="text-[#58a6ff] bg-[#121929] px-1.5 py-0.5 rounded border border-[#1f2d42]">
                          {filePath}
                        </code>
                      </div>
                    )}

                    {/* Full Raw Payload Inspector */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase text-[#6e7681]">
                          Event Raw Payload & Output:
                        </span>
                        <button
                          onClick={() => handleCopyEntry(log, idx)}
                          className="text-[10px] text-[#58a6ff] hover:underline flex items-center gap-1"
                        >
                          {copiedIndex === idx ? <Check size={11} className="text-[#3fb950]" /> : <Copy size={11} />}
                          <span>{copiedIndex === idx ? 'Copied' : 'Copy Entry'}</span>
                        </button>
                      </div>

                      <pre className="p-2.5 rounded bg-[#07090f] border border-[#151d2e] text-[#c9d1d9] text-[11px] font-mono overflow-x-auto whitespace-pre-wrap max-h-72 leading-relaxed">
                        {typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
