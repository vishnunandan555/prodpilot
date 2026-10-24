import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Search,
  Copy,
  Check,
  RotateCcw,
  Pause,
  Play,
  ArrowDown
} from 'lucide-react';

export default function MasterLogsView({ apiUrl }) {
  const [consoleLines, setConsoleLines] = useState([]);
  const [plainText, setPlainText] = useState('');
  const [viewMode, setViewMode] = useState('console'); // 'console' | 'raw'
  const [isLoading, setIsLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedLineIdx, setCopiedLineIdx] = useState(null);

  const consoleEndRef = useRef(null);
  const terminalScrollRef = useRef(null);

  const fetchMasterLogs = async (isManual = false) => {
    if (isManual) setIsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/platform/master-logs?limit=500`);
      if (res.ok) {
        const data = await res.json();
        setConsoleLines(data.console_lines || []);
        setPlainText(data.plain_text || '');
      }
    } catch (err) {
      console.warn('Failed to stream platform console logs:', err);
    } finally {
      if (isManual) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterLogs(true);
  }, [apiUrl]);

  // Periodic polling for live console stream
  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      fetchMasterLogs(false);
    }, 3000);
    return () => clearInterval(interval);
  }, [isStreaming, apiUrl]);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLines, autoScroll]);

  const handleCopyAll = () => {
    const textToCopy = filteredLines.map((l) => l.raw).join('\n') || plainText;
    navigator.clipboard.writeText(textToCopy);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopyLine = (raw, idx) => {
    navigator.clipboard.writeText(raw);
    setCopiedLineIdx(idx);
    setTimeout(() => setCopiedLineIdx(null), 1500);
  };

  const handleClear = () => {
    setConsoleLines([]);
    setPlainText('');
  };

  // Grep filter
  const filteredLines = consoleLines.filter((line) => {
    if (!filterQuery) return true;
    return line.raw.toLowerCase().includes(filterQuery.toLowerCase());
  });

  const getLevelColor = (level) => {
    switch ((level || '').trim().toUpperCase()) {
      case 'ERROR':
      case 'FAIL':
        return 'text-[#f85149] font-bold';
      case 'WARN':
        return 'text-[#d29922] font-semibold';
      case 'PASS':
      case 'SUCCESS':
        return 'text-[#3fb950] font-bold';
      case 'TOOL':
        return 'text-[#a371f7] font-semibold';
      case 'LLM':
        return 'text-[#d2a8ff] font-bold';
      case 'MSG':
        return 'text-[#39c5bb] font-semibold';
      case 'PR':
        return 'text-[#58a6ff] font-semibold';
      case 'JEV':
        return 'text-[#bc8cff] font-semibold';
      case 'INFO':
        return 'text-[#79c0ff]';
      default:
        return 'text-[#8b949e]';
    }
  };

  const getTagColor = (tag) => {
    const t = (tag || '').trim().toUpperCase();
    if (t.includes('WATCHDOG')) return 'text-[#ff7b72]';
    if (t.includes('TAKEOVER')) return 'text-[#f0883e] font-bold';
    if (t.includes('DEPLOY') || t.includes('APPROVAL')) return 'text-[#3fb950] font-bold';
    if (t.includes('OPERATOR') || t.includes('BUTTON')) return 'text-[#58a6ff] font-semibold';
    if (t.includes('HOLD') || t.includes('RESUME')) return 'text-[#db61a2] font-semibold';
    if (t.includes('GEMINI') || t.includes('ANTIGRAV') || t.includes('LLM')) return 'text-[#d2a8ff] font-semibold';
    if (t.includes('TELEGRAM') || t.includes('MSG')) return 'text-[#39c5bb] font-semibold';
    if (t.includes('AGENT')) return 'text-[#d2a8ff]';
    if (t.includes('VERIFIER')) return 'text-[#7ee787]';
    if (t.includes('GITHUB')) return 'text-[#79c0ff]';
    if (t.includes('JEV')) return 'text-[#ffa657]';
    return 'text-[#8b949e]';
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090d16] text-[#c9d1d9] font-mono select-text overflow-hidden">
      {/* Terminal Top Control Bar */}
      <div className="h-11 px-3 bg-[#0d121f] border-b border-[#1b2333] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 mr-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
          </div>
          <Terminal size={14} className="text-[#58a6ff]" />
          <span className="text-xs font-semibold text-[#f0f6fc] tracking-tight">
            platform-master.log
          </span>
          {isStreaming ? (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[#238636]/20 text-[#3fb950] border border-[#238636]/40">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#30363d] text-[#8b949e]">
              PAUSED
            </span>
          )}
          <span className="text-[11px] text-[#6e7681]">
            ({filteredLines.length} lines)
          </span>
        </div>

        {/* Console Controls */}
        <div className="flex items-center gap-2 text-xs">
          {/* Mode Switch: Console vs Raw Text */}
          <div className="flex items-center bg-[#161f30] rounded p-0.5 border border-[#26354d]">
            <button
              onClick={() => setViewMode('console')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                viewMode === 'console'
                  ? 'bg-[#1f2b42] text-[#58a6ff] font-semibold'
                  : 'text-[#8b949e] hover:text-[#c9d1d9]'
              }`}
            >
              Console
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                viewMode === 'raw'
                  ? 'bg-[#1f2b42] text-[#58a6ff] font-semibold'
                  : 'text-[#8b949e] hover:text-[#c9d1d9]'
              }`}
            >
              Raw Text
            </button>
          </div>

          {/* Grep Search */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6e7681]" />
            <input
              type="text"
              placeholder="grep / filter console..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-44 pl-7 pr-2 py-1 bg-[#161f30] border border-[#26354d] rounded text-[11px] text-[#f0f6fc] placeholder-[#6e7681] focus:outline-none focus:border-[#58a6ff] transition font-mono"
            />
          </div>

          {/* Toggle Auto-scroll */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2.5 py-1 rounded border text-[11px] flex items-center gap-1 transition ${
              autoScroll
                ? 'bg-[#1b2b48] border-[#388bfd]/40 text-[#58a6ff]'
                : 'bg-[#161f30] border-[#26354d] text-[#8b949e] hover:text-[#c9d1d9]'
            }`}
            title="Auto-scroll to bottom on new logs"
          >
            <ArrowDown size={11} className={autoScroll ? 'animate-bounce' : ''} />
            <span>Auto-scroll</span>
          </button>

          {/* Pause / Resume */}
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className="px-2.5 py-1 rounded bg-[#161f30] hover:bg-[#1f2b42] border border-[#26354d] text-[#c9d1d9] text-[11px] flex items-center gap-1 transition"
          >
            {isStreaming ? <Pause size={11} /> : <Play size={11} />}
            <span>{isStreaming ? 'Pause' : 'Resume'}</span>
          </button>

          {/* Copy All */}
          <button
            onClick={handleCopyAll}
            className="px-2.5 py-1 rounded bg-[#161f30] hover:bg-[#1f2b42] border border-[#26354d] text-[#c9d1d9] text-[11px] flex items-center gap-1 transition active:scale-95"
            title="Copy all lines to clipboard"
          >
            {copiedAll ? <Check size={11} className="text-[#3fb950]" /> : <Copy size={11} />}
            <span>{copiedAll ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Clear View */}
          <button
            onClick={handleClear}
            className="px-2 py-1 rounded bg-[#161f30] hover:bg-[#261317] border border-[#26354d] hover:border-[#ff4444]/40 text-[#8b949e] hover:text-[#ff7b72] text-[11px] transition"
            title="Clear current view"
          >
            <RotateCcw size={11} />
          </button>
        </div>
      </div>

      {/* Pure Terminal Log Viewport */}
      <div
        ref={terminalScrollRef}
        className="flex-1 p-3 overflow-y-auto overflow-x-auto text-[11.5px] leading-relaxed selection:bg-[#1f3a5f] selection:text-[#f0f6fc]"
      >
        {isLoading && consoleLines.length === 0 ? (
          <div className="text-[#6e7681] italic py-4">Connecting to platform master console stream...</div>
        ) : filteredLines.length === 0 ? (
          <div className="text-[#6e7681] italic py-4">
            {filterQuery ? `No console lines matching "${filterQuery}"` : 'No logs recorded yet.'}
          </div>
        ) : viewMode === 'raw' ? (
          <div className="p-1">
            <pre className="font-mono text-[11px] leading-relaxed text-[#e6edf3] whitespace-pre-wrap select-text">
              {filteredLines.map((l) => l.raw).join('\n')}
            </pre>
            <div ref={consoleEndRef} />
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredLines.map((line, idx) => (
              <div
                key={line.id || idx}
                onClick={() => handleCopyLine(line.raw, idx)}
                className="group flex items-start gap-2 px-1.5 py-0.5 rounded hover:bg-[#161f30]/60 cursor-pointer transition"
                title="Click line to copy"
              >
                {/* Line Number */}
                <span className="w-8 shrink-0 text-right text-[#484f58] group-hover:text-[#6e7681] select-none text-[10px]">
                  {idx + 1}
                </span>

                {/* Timestamp */}
                <span className="text-[#6e7681] shrink-0 select-none">
                  [{line.timestamp}]
                </span>

                {/* Level */}
                <span className={`w-12 shrink-0 ${getLevelColor(line.level)}`}>
                  [{line.level}]
                </span>

                {/* Tag / Stage */}
                <span className={`w-28 shrink-0 truncate ${getTagColor(line.tag)}`}>
                  [{line.tag}]
                </span>

                {/* Message */}
                <span className="text-[#e6edf3] whitespace-pre-wrap break-all flex-1">
                  {line.message}
                </span>

                {/* Copy Indicator */}
                <span className="opacity-0 group-hover:opacity-100 text-[10px] text-[#58a6ff] shrink-0 select-none transition">
                  {copiedLineIdx === idx ? 'copied!' : 'copy'}
                </span>
              </div>
            ))}
            <div ref={consoleEndRef} />
          </div>
        )}
      </div>

      {/* Terminal Footer Status Bar */}
      <div className="h-6 px-3 bg-[#0d121f] border-t border-[#1b2333] flex items-center justify-between text-[10px] text-[#6e7681] shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          <span>•</span>
          <span>ProdPilot Platform Master Stream</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Click any line to copy</span>
          <span>•</span>
          <span>Auto-scroll: {autoScroll ? 'ON' : 'OFF'}</span>
        </div>
      </div>
    </div>
  );
}
