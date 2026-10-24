import React, { useState } from 'react';
import {
  Bot,
  Terminal,
  Cpu,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  FileText,
  Search,
  FolderTree,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Play,
  RotateCcw,
  Check,
  Server,
  Activity,
  ArrowRight,
  Maximize2,
  Minimize2,
  Copy,
  ExternalLink
} from 'lucide-react';

export default function AgentExecutionConsole({
  incident,
  events = [],
  isCompact = false,
  onApprove,
  onRollback,
  onTakeover,
  actionLoading = false,
}) {
  const [activeViewMode, setActiveViewMode] = useState('unified'); // 'unified' | 'terminal' | 'thoughts'
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'thoughts' | 'tools' | 'tests'
  const [wrapTerminalLines, setWrapTerminalLines] = useState(true);
  const [expandedIndices, setExpandedIndices] = useState(new Set());
  const [copiedIndex, setCopiedIndex] = useState(null);

  if (!incident) return null;

  const status = incident.status || 'DETECTED';
  const isAwaiting = status === 'AWAITING_APPROVAL';
  const isFixing = status === 'FIXING';
  const isInvestigating = status === 'INVESTIGATING' || status === 'UNDERSTAND' || status === 'DETECTED';
  const isResolved = status === 'DEPLOYED' || status === 'RESOLVED' || status === 'ROLLED_BACK' || status === 'MANUAL_TAKEOVER' || status === 'DISMISSED';
  const isTakeover = status === 'MANUAL_TAKEOVER';

  // Build unified, chronological list of all agent actions
  const unifiedStream = [];

  events.forEach((ev, idx) => {
    const stage = ev.stage || 'EXECUTE';
    const kind = ev.kind || 'tool_call';
    const payload = ev.payload || {};
    const ts = ev.ts ? new Date(ev.ts).toLocaleTimeString() : `Step ${idx + 1}`;

    const isThought = kind === 'thought' || kind === 'stage_started' || kind === 'agent_step' || stage === 'UNDERSTAND' || stage === 'DECIDE';
    const isTest = kind === 'test_result' || stage === 'VERIFY';
    const isTool = kind === 'tool_call' || (!isThought && !isTest);

    let headline = payload.message || payload.summary || payload.error || '';
    if (!headline && payload.thought) headline = payload.thought;
    if (payload.task && (!headline || headline.length < payload.task.length)) headline = payload.task;

    // Hydrate truncated tasks if brief summary is available
    if (headline.includes('Summary: Timeo...') && incident.brief?.summary) {
      headline = headline.replace('Summary: Timeo...', `Summary: ${incident.brief.summary}`);
    }

    const params = payload.parameters || payload.args || {};
    const commandLine = params.CommandLine || params.command || payload.command;
    const targetFile = params.TargetFile || params.Path || params.AbsolutePath || payload.path;

    unifiedStream.push({
      id: ev.id || idx,
      index: idx,
      ts,
      stage,
      kind,
      isThought,
      isTool,
      isTest,
      toolName: payload.tool || kind,
      headline,
      commandLine,
      targetFile,
      params,
      result: payload.result || payload.output || payload.details || (typeof payload === 'string' ? payload : null),
      payload,
      state: payload.state || (isTest ? (payload.passed ? 'DONE' : 'FAIL') : 'DONE'),
    });
  });

  const toggleExpand = (idx) => {
    setExpandedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIndices(new Set(unifiedStream.map((_, i) => i)));
  };

  const collapseAll = () => {
    setExpandedIndices(new Set());
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyAllTerminal = () => {
    const fullText = unifiedStream.map((item) => {
      let line = `[${item.ts}] [${item.stage}] `;
      if (item.isThought) line += `[PLAN] ${item.headline}`;
      else if (item.commandLine) line += `$ ${item.commandLine}`;
      else if (item.targetFile) line += `[${item.toolName}] ${item.targetFile}`;
      else line += item.headline || item.toolName;
      if (item.result) {
        line += `\nOutput: ${typeof item.result === 'string' ? item.result : JSON.stringify(item.result, null, 2)}`;
      }
      return line;
    }).join('\n');
    navigator.clipboard.writeText(fullText);
    setCopiedIndex('all-terminal');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Filter items
  const filteredStream = unifiedStream.filter((item) => {
    if (filterMode === 'all') return true;
    if (filterMode === 'thoughts') return item.isThought;
    if (filterMode === 'tools') return item.isTool;
    if (filterMode === 'tests') return item.isTest;
    return true;
  });

  const getToolIcon = (name) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('pytest') || lower.includes('test')) return Play;
    if (lower.includes('read') || lower.includes('file')) return FileText;
    if (lower.includes('write') || lower.includes('replace') || lower.includes('edit')) return FileCode;
    if (lower.includes('list') || lower.includes('dir')) return FolderTree;
    if (lower.includes('grep') || lower.includes('search')) return Search;
    if (lower.includes('decision')) return Zap;
    return Terminal;
  };

  return (
    <div className="rounded-xl bg-[#0d111a] border border-[#1b2234] overflow-hidden shadow-xl space-y-0 font-sans">
      {/* Console Top Header Bar */}
      <div className="px-4 py-3 bg-[#0a0e17] border-b border-[#1b2234] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#121929] border border-[#1f6feb]/40 flex items-center justify-center text-[#58a6ff]">
            <Bot size={17} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#f0f6fc] tracking-tight">Execution Console</span>
            </div>
            <p className="text-[11px] text-[#8b949e]">
              Live agent steps and tool calls
            </p>
          </div>
        </div>

        {/* Action Controls & Filter Modes */}
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg bg-[#05070a] border border-[#1b2234] p-0.5 text-xs">
            <button
              onClick={() => setActiveViewMode('unified')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                activeViewMode === 'unified'
                  ? 'bg-[#1f6feb] text-white shadow-xs'
                  : 'text-[#8b949e] hover:text-[#c9d1d9]'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setActiveViewMode('terminal')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                activeViewMode === 'terminal'
                  ? 'bg-[#1f6feb] text-white shadow-xs'
                  : 'text-[#8b949e] hover:text-[#c9d1d9]'
              }`}
            >
              Terminal
            </button>
          </div>

          <button
            onClick={expandedIndices.size === unifiedStream.length ? collapseAll : expandAll}
            className="px-2.5 py-1 rounded-md bg-[#121824] hover:bg-[#1b2436] border border-[#1b2234] text-[11px] font-semibold text-[#8b949e] hover:text-[#f0f6fc] transition"
          >
            {expandedIndices.size === unifiedStream.length ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
      </div>

      {/* Sub-Filter Navigation Bar (Unified Mode) */}
      {activeViewMode === 'unified' && (
        <div className="px-4 py-2 bg-[#07090f] border-b border-[#1b2234] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            {[
              { id: 'all', label: 'All', count: unifiedStream.length },
              { id: 'thoughts', label: 'Thoughts', count: unifiedStream.filter((s) => s.isThought).length },
              { id: 'tools', label: 'Tool Calls', count: unifiedStream.filter((s) => s.isTool).length },
              { id: 'tests', label: 'Verifications', count: unifiedStream.filter((s) => s.isTest).length },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterMode(f.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition flex items-center gap-1 ${
                  filterMode === f.id
                    ? 'bg-[#161f30] text-[#58a6ff] border border-[#2b3a58]'
                    : 'text-[#8b949e] hover:bg-[#121824] border border-transparent'
                }`}
              >
                <span>{f.label}</span>
                <span className="text-[10px] opacity-75 font-mono">({f.count})</span>
              </button>
            ))}
          </div>

          <span className="text-[10px] font-mono text-[#6e7681]">
            {unifiedStream.length} steps
          </span>
        </div>
      )}

      {/* Main Stream Area */}
      <div className="p-4 bg-[#080b11] select-text">
        {activeViewMode === 'terminal' ? (
          /* Live Terminal Feed Mode */
          <div className="rounded-lg bg-[#05070a] border border-[#1b2234] p-3 font-mono text-xs text-[#c9d1d9] space-y-2 max-h-[550px] overflow-y-auto select-text">
            <div className="text-[11px] text-[#58a6ff] pb-2 border-b border-[#1b2234] flex flex-wrap items-center justify-between gap-2 select-none">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#f0f6fc]">Terminal</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWrapTerminalLines(!wrapTerminalLines)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition border ${
                    wrapTerminalLines
                      ? 'bg-[#161f30] text-[#58a6ff] border-[#2b3a58]'
                      : 'bg-[#0b0e14] text-[#8b949e] border-[#1b2234]'
                  }`}
                  title="Toggle Word Wrap"
                >
                  {wrapTerminalLines ? 'Wrap: ON' : 'Wrap: OFF'}
                </button>
                <button
                  type="button"
                  onClick={handleCopyAllTerminal}
                  className="px-2 py-0.5 rounded bg-[#161f30] hover:bg-[#1f2c45] border border-[#2b3a58] text-[10px] font-mono text-[#58a6ff] hover:text-white flex items-center gap-1 transition"
                  title="Copy complete terminal stream to clipboard"
                >
                  {copiedIndex === 'all-terminal' ? <Check size={11} className="text-[#3fb950]" /> : <Copy size={11} />}
                  <span>{copiedIndex === 'all-terminal' ? 'Copied All' : 'Copy All'}</span>
                </button>
              </div>
            </div>

            {unifiedStream.length === 0 ? (
              <div className="text-[#6e7681] italic py-4">Waiting for process output...</div>
            ) : (
              <div className={`space-y-1.5 pt-1 ${wrapTerminalLines ? 'break-words' : 'overflow-x-auto'}`}>
                {unifiedStream.map((item, idx) => (
                  <div key={idx} className="space-y-1 select-text group relative rounded hover:bg-[#0c0f18] p-1 transition">
                    {item.isThought && (
                      <div className={`text-[#a371f7] text-[11px] leading-relaxed select-text ${wrapTerminalLines ? 'whitespace-pre-wrap' : 'whitespace-pre'}`}>
                        <span className="text-[#6e7681] mr-1.5 select-none">[{item.ts}]</span>
                        <span className="mr-1.5 px-1 py-0.2 rounded bg-[#1f1430] text-[#c084fc] border border-[#3b275c] text-[9px] font-mono select-none">STEP</span>
                        <span className="select-text">{item.headline}</span>
                      </div>
                    )}
                    {item.commandLine && (
                      <div className={`text-[#3fb950] font-bold text-[11px] leading-relaxed select-text ${wrapTerminalLines ? 'whitespace-pre-wrap' : 'whitespace-pre'}`}>
                        <span className="text-[#6e7681] font-normal mr-1.5 select-none">[{item.ts}]</span>
                        <span className="text-[#58a6ff] mr-1 select-none">$</span>
                        <span className="select-text">{item.commandLine}</span>
                      </div>
                    )}
                    {item.targetFile && !item.commandLine && (
                      <div className={`text-[#58a6ff] text-[11px] leading-relaxed select-text ${wrapTerminalLines ? 'whitespace-pre-wrap' : 'whitespace-pre'}`}>
                        <span className="text-[#6e7681] mr-1.5 select-none">[{item.ts}]</span>
                        <span className="mr-1.5 px-1 py-0.2 rounded bg-[#162033] text-[#79c0ff] border border-[#27395b] text-[9px] font-mono select-none">{item.toolName}</span>
                        <span className="select-text font-mono">{item.targetFile}</span>
                      </div>
                    )}
                    {item.result && (
                      <div className="pl-4 group/res relative">
                        <pre className="text-[#8b949e] text-[10px] whitespace-pre-wrap max-h-48 overflow-y-auto select-text p-1.5 rounded bg-[#070a10] border border-[#141a26]">
                          {typeof item.result === 'string' ? item.result : JSON.stringify(item.result, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Unified Interactive Stream Mode */
          <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1 select-text">
            {filteredStream.length === 0 ? (
              <div className="p-8 text-center text-[#6e7681] text-xs">
                No events match the selected category.
              </div>
            ) : (
              filteredStream.map((item) => {
                const isExpanded = expandedIndices.has(item.index);
                const IconComp = getToolIcon(item.toolName);

                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border transition overflow-hidden select-text ${
                      item.isThought
                        ? 'bg-[#0d111a] border-[#1f2738]'
                        : item.isTest
                        ? 'bg-[#0a1219] border-[#1d3d2b]'
                        : 'bg-[#0a0e17] border-[#1b2234]'
                    }`}
                  >
                    {/* Header Row */}
                    <div
                      onClick={() => toggleExpand(item.index)}
                      className="px-3.5 py-2.5 flex items-start sm:items-center justify-between gap-3 cursor-pointer hover:bg-[#0f1422] transition select-text"
                    >
                      <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                        {/* Type Icon */}
                        {item.isThought ? (
                          <div className="w-5 h-5 rounded-full bg-[#161226] border border-[#2e2350] flex items-center justify-center text-[#a371f7] flex-shrink-0 mt-0.5 sm:mt-0 select-none">
                            <Sparkles size={11} />
                          </div>
                        ) : (
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0 select-none ${
                            item.state === 'FAIL'
                              ? 'bg-[#261317] border border-[#4a1c24] text-[#ff7b72]'
                              : 'bg-[#0f1f1d] border border-[#1b3d2b] text-[#3fb950]'
                          }`}>
                            <IconComp size={11} />
                          </div>
                        )}

                        {/* Timestamp */}
                        <span className="text-[10px] text-[#6e7681] font-mono flex-shrink-0 select-none">
                          {item.ts}
                        </span>

                        {/* Stage Tag */}
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-[#161b24] text-[#8b949e] border border-[#21262d] flex-shrink-0 select-none">
                          {item.stage}
                        </span>

                        {/* Main Title / Command Line */}
                        <div className="text-xs font-medium flex-1 break-words select-text leading-relaxed">
                          {item.commandLine ? (
                            <span className="text-[#3fb950] font-mono font-bold select-text">
                              $ {item.commandLine}
                            </span>
                          ) : item.headline ? (
                            <span className={`${item.isThought ? 'text-[#c9d1d9]' : 'text-[#f0f6fc]'} select-text`}>
                              {item.headline}
                            </span>
                          ) : (
                            <span className="text-[#8b949e] select-text">
                              {item.toolName} {item.targetFile || ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right-hand Status, Copy button & Chevron */}
                      <div className="flex items-center gap-2 flex-shrink-0 select-none ml-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(item.headline || item.commandLine || item.targetFile, item.index);
                          }}
                          className="p-1 rounded text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#161f30] transition"
                          title="Copy line text"
                        >
                          {copiedIndex === item.index ? <Check size={11} className="text-[#3fb950]" /> : <Copy size={11} />}
                        </button>
                        {item.state && (
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
                            item.state === 'FAIL'
                              ? 'bg-[#261317] text-[#ff7b72] border border-[#4a1c24]'
                              : 'bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b]'
                          }`}>
                            {item.state}
                          </span>
                        )}
                        {isExpanded ? <ChevronUp size={13} className="text-[#8b949e]" /> : <ChevronDown size={13} className="text-[#8b949e]" />}
                      </div>
                    </div>

                    {/* Expandable Details Drawer */}
                    {isExpanded && (
                      <div className="px-4 py-3 bg-[#05070a] border-t border-[#1b2234] space-y-2.5 text-xs font-mono">
                        {/* Target File link */}
                        {item.targetFile && (
                          <div className="flex items-center gap-2 text-[11px] text-[#8b949e]">
                            <span className="text-[#6e7681] font-semibold">Target File:</span>
                            <code className="text-[#58a6ff] bg-[#0c121e] px-1.5 py-0.5 rounded border border-[#1c283d]">
                              {item.targetFile}
                            </code>
                          </div>
                        )}

                        {/* Input Parameters */}
                        {item.params && Object.keys(item.params).length > 0 && (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#6e7681] block mb-1">
                              Parameters & Arguments:
                            </span>
                            <pre className="p-2 rounded bg-[#07090f] border border-[#151d2e] text-[#58a6ff] overflow-x-auto text-[11px]">
                              {JSON.stringify(item.params, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Output / Result Block */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] uppercase font-bold text-[#6e7681]">
                              Execution Output / Stdout:
                            </span>
                            <button
                              onClick={() => handleCopy(item.result || item.payload, item.index)}
                              className="text-[10px] text-[#58a6ff] hover:underline flex items-center gap-1"
                            >
                              {copiedIndex === item.index ? <Check size={11} className="text-[#3fb950]" /> : <Copy size={11} />}
                              <span>{copiedIndex === item.index ? 'Copied' : 'Copy Output'}</span>
                            </button>
                          </div>
                          <pre className="p-2.5 rounded bg-[#07090f] border border-[#151d2e] text-[#c9d1d9] overflow-x-auto whitespace-pre-wrap max-h-60 text-[11px] leading-relaxed">
                            {typeof item.result === 'string'
                              ? item.result
                              : item.result
                              ? JSON.stringify(item.result, null, 2)
                              : JSON.stringify(item.payload, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Operator Approval Gate Banner */}
        {isAwaiting && (
          <div className="mt-4 rounded-lg bg-[#14120b] border-2 border-[#d29922]/50 p-4 space-y-3 shadow-xl animate-in fade-in">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#271d0c] border border-[#d29922]/40 flex items-center justify-center text-[#d29922] flex-shrink-0">
                <ShieldAlert size={18} />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-bold text-[#f0f6fc]">
                  Approval Required
                </h3>
                <p className="text-xs text-[#8b949e] mt-1 leading-relaxed">
                  Fix synthesized and verified across canaries. Awaiting your approval.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => onApprove && onApprove('fix_forward')}
                disabled={actionLoading}
                className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Check size={14} />
                <span>{actionLoading ? 'Deploying...' : 'Deploy'}</span>
              </button>

              <button
                onClick={() => onRollback && onRollback()}
                disabled={actionLoading}
                className="px-3.5 py-2 bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-xs font-semibold rounded-lg border border-[#30363d] flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <RotateCcw size={14} className="text-[#f85149]" />
                <span>Rollback</span>
              </button>

              <button
                onClick={() => onTakeover && onTakeover()}
                disabled={actionLoading}
                className="px-3.5 py-2 bg-[#121929] hover:bg-[#1b263b] text-[#58a6ff] text-xs font-semibold rounded-lg border border-[#1f2d42] flex items-center gap-1.5 transition"
              >
                <span>Manual Takeover</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
