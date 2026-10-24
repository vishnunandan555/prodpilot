import React, { useState } from 'react';
import {
  Copy,
  Check,
  FileCode,
  Columns,
  AlignLeft,
  GitCommit,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Layers,
  FileDiff,
  Plus,
  Minus
} from 'lucide-react';

/**
 * Robust Unified Diff Parser
 * Parses unified git diff into side-by-side before/after aligned rows
 */
export function parseDiff(diffText) {
  if (!diffText) return { files: [], stats: { additions: 0, deletions: 0 } };

  const lines = diffText.split('\n');
  const files = [];
  let currentFile = null;
  let additions = 0;
  let deletions = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('diff --git')) {
      const match = line.match(/diff --git a\/(.+) b\/(.+)/);
      currentFile = {
        filename: match ? match[2] : 'patch.diff',
        hunks: [],
        additions: 0,
        deletions: 0,
      };
      files.push(currentFile);
      continue;
    }

    if (line.startsWith('--- ') || line.startsWith('+++ ') || line.startsWith('index ')) {
      if (!currentFile && line.startsWith('+++ b/')) {
        currentFile = {
          filename: line.slice(6).trim(),
          hunks: [],
          additions: 0,
          deletions: 0,
        };
        files.push(currentFile);
      }
      continue;
    }

    if (line.startsWith('@@')) {
      if (!currentFile) {
        currentFile = {
          filename: 'patch.diff',
          hunks: [],
          additions: 0,
          deletions: 0,
        };
        files.push(currentFile);
      }
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/);
      const oldLineStart = match ? parseInt(match[1], 10) : 1;
      const newLineStart = match ? parseInt(match[2], 10) : 1;
      const contextTitle = match ? match[3].trim() : '';

      currentFile.hunks.push({
        header: line,
        contextTitle,
        oldLineStart,
        newLineStart,
        rawLines: [],
      });
      continue;
    }

    if (currentFile && currentFile.hunks.length > 0) {
      const hunk = currentFile.hunks[currentFile.hunks.length - 1];
      hunk.rawLines.push(line);
    }
  }

  // Fallback: If no git header or @@, create default hunk from raw changes
  if (files.length === 0 && lines.some((l) => l.startsWith('+') || l.startsWith('-'))) {
    files.push({
      filename: 'patch.diff',
      hunks: [{ header: '@@ changes @@', contextTitle: '', oldLineStart: 1, newLineStart: 1, rawLines: lines }],
      additions: 0,
      deletions: 0,
    });
  }

  // Process raw lines of each hunk into side-by-side paired rows
  for (const file of files) {
    for (const hunk of file.hunks) {
      const rows = [];
      let oldLine = hunk.oldLineStart;
      let newLine = hunk.newLineStart;
      let delBuffer = [];
      let addBuffer = [];

      const flushBuffers = () => {
        const maxLen = Math.max(delBuffer.length, addBuffer.length);
        for (let j = 0; j < maxLen; j++) {
          const leftItem = delBuffer[j] || null;
          const rightItem = addBuffer[j] || null;
          let rowType = 'change';
          if (leftItem && !rightItem) rowType = 'del';
          else if (!leftItem && rightItem) rowType = 'add';
          rows.push({ type: rowType, left: leftItem, right: rightItem });
        }
        delBuffer = [];
        addBuffer = [];
      };

      for (const line of hunk.rawLines) {
        if (line.startsWith('-')) {
          deletions++;
          file.deletions++;
          delBuffer.push({ num: oldLine++, text: line.slice(1) });
        } else if (line.startsWith('+')) {
          additions++;
          file.additions++;
          addBuffer.push({ num: newLine++, text: line.slice(1) });
        } else {
          flushBuffers();
          const cleanLine = line.startsWith(' ') ? line.slice(1) : line;
          rows.push({
            type: 'same',
            left: { num: oldLine++, text: cleanLine },
            right: { num: newLine++, text: cleanLine },
          });
        }
      }
      flushBuffers();
      hunk.rows = rows;
    }
  }

  return { files, stats: { additions, deletions } };
}

export default function DiffViewer({
  diff = '',
  diffText = '',
  filename = null,
  suspectedArea = null,
  suspectCommit = null,
  service = null,
}) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'unified'
  const [wrapLines, setWrapLines] = useState(false);

  const textToDisplay = (diff || diffText || '').trim();
  const parsed = parseDiff(textToDisplay);

  const handleCopy = () => {
    navigator.clipboard.writeText(textToDisplay);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // If no files were parsed or diff is empty, show IDE-like candidate preview
  if (parsed.files.length === 0) {
    return (
      <div className="border border-[#1b2234] rounded-xl overflow-hidden bg-[#07090f] text-[12px] shadow-lg font-sans">
        {/* IDE Top Bar */}
        <div className="px-4 py-2.5 bg-[#0d111a] border-b border-[#1b2234] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-[#161f30] border border-[#263550] flex items-center justify-center text-[#58a6ff]">
              <FileCode size={13} />
            </div>
            <div>
              <span className="font-mono font-semibold text-[#f0f6fc] text-xs">
                {filename || suspectedArea || (service ? `${service}/hotfix.patch` : 'hotfix.patch')}
              </span>
              <span className="ml-2 text-[10px] font-mono px-2 py-0.5 rounded bg-[#161f30] text-[#79c0ff] border border-[#263550]">
                IDE Diff Comparison
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#241a0c] text-[#d29922] border border-[#442c16]">
              Awaiting Patch Synthesis
            </span>
          </div>
        </div>

        {/* Side-by-Side Dual Windows Placeholder */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#1b2234] bg-[#05070a]">
          {/* Left Window: Before (Base Outage) */}
          <div className="flex flex-col">
            <div className="px-3 py-2 bg-[#140b0f] border-b border-[#3e1b23] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#f85149]" />
                <span className="font-bold text-[#ff7b72] font-mono text-[11px] uppercase tracking-wider">
                  BEFORE: Production Baseline (Buggy)
                </span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#261317] text-[#ff7b72] border border-[#4a1c24]">
                {suspectCommit ? `Commit: ${suspectCommit}` : 'HEAD~1 (Active Crash)'}
              </span>
            </div>
            <div className="p-4 font-mono text-xs space-y-3 flex-1 flex flex-col justify-center">
              <div className="p-3 rounded bg-[#0d090d] border border-[#3e1b23] space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-[#ff7b72] block">Suspected Failure Area</span>
                <p className="text-[#ff7b72] text-[11px] leading-relaxed">
                  {suspectedArea || 'Unhandled runtime exception causing container crash or timeout.'}
                </p>
              </div>
              <p className="text-[11px] text-[#8b949e] italic leading-relaxed">
                Base production code that triggered the active incident. Original logic pending defensive replacement.
              </p>
            </div>
          </div>

          {/* Right Window: After (Sandbox Patch) */}
          <div className="flex flex-col">
            <div className="px-3 py-2 bg-[#0a1611] border-b border-[#1b3d2b] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#3fb950] animate-pulse" />
                <span className="font-bold text-[#3fb950] font-mono text-[11px] uppercase tracking-wider">
                  AFTER: Remediation Patch (Fixed)
                </span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b]">
                prodpilot/fix-forward
              </span>
            </div>
            <div className="p-4 font-mono text-xs space-y-3 flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-9 h-9 rounded-xl bg-[#161f30] border border-[#263550] flex items-center justify-center text-[#58a6ff] shadow-lg shadow-[#58a6ff]/10">
                <Sparkles size={16} className="animate-spin" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#f0f6fc]">Synthesizing Defensive Fix</p>
                <p className="text-[11px] text-[#8b949e] mt-1 max-w-xs">
                  Remediation sandbox is isolating the worktree, writing regression reproduction tests, and validating code changes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const primaryFile = parsed.files[0];
  const detectedFilename = filename || primaryFile.filename || 'patch.diff';

  return (
    <div className="border border-[#1b2234] rounded-xl overflow-hidden bg-[#07090f] text-[12px] shadow-lg font-sans">
      {/* IDE Diff Toolbar */}
      <div className="px-4 py-2.5 bg-[#0d111a] border-b border-[#1b2234] flex flex-wrap items-center justify-between gap-3 select-none">
        {/* Left: File Path & Stats */}
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-[#161f30] border border-[#263550] flex items-center justify-center text-[#58a6ff]">
            <FileCode size={13} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-[#f0f6fc] text-xs">
                {detectedFilename}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#122419] text-[#3fb950] border border-[#1f4a2b] font-bold">
                +{parsed.stats.additions}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#261317] text-[#ff7b72] border border-[#4a1c24] font-bold">
                -{parsed.stats.deletions}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Controls & View Toggle */}
        <div className="flex items-center gap-2">
          {/* Split vs Unified Toggle */}
          <div className="flex items-center rounded-md bg-[#07090f] border border-[#1b2234] p-0.5 text-xs font-mono">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition text-[11px] font-medium ${
                viewMode === 'split'
                  ? 'bg-[#1f293d] text-[#f0f6fc] font-bold shadow-xs'
                  : 'text-[#8b949e] hover:text-[#c9d1d9]'
              }`}
              title="Side-by-Side Split Diff (Before vs After)"
            >
              <Columns size={12} className={viewMode === 'split' ? 'text-[#58a6ff]' : ''} />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('unified')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition text-[11px] font-medium ${
                viewMode === 'unified'
                  ? 'bg-[#1f293d] text-[#f0f6fc] font-bold shadow-xs'
                  : 'text-[#8b949e] hover:text-[#c9d1d9]'
              }`}
              title="Unified Inline Diff"
            >
              <AlignLeft size={12} className={viewMode === 'unified' ? 'text-[#58a6ff]' : ''} />
              <span>Unified</span>
            </button>
          </div>

          {/* Copy Patch */}
          <button
            type="button"
            onClick={handleCopy}
            className="px-2.5 py-1 rounded bg-[#161b26] hover:bg-[#212a3d] text-[#c9d1d9] border border-[#212a3d] text-[11px] font-mono flex items-center gap-1.5 transition"
            title="Copy diff patch to clipboard"
          >
            {copied ? <Check size={12} className="text-[#3fb950]" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy Patch'}</span>
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: SPLIT (SIDE-BY-SIDE BEFORE VS AFTER) */}
      {viewMode === 'split' && (
        <div className="flex flex-col overflow-hidden">
          {/* Dual Window Header Bar */}
          <div className="grid grid-cols-2 border-b border-[#1b2234] text-xs font-mono select-none">
            {/* Left Header: BEFORE */}
            <div className="px-3 py-1.5 bg-[#120b0e] border-r border-[#1b2234] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Minus size={13} className="text-[#ff7b72] font-bold" />
                <span className="font-bold text-[#ff7b72] text-[11px] tracking-wide uppercase">
                  BEFORE: Baseline Outage
                </span>
              </div>
              <span className="text-[10px] text-[#ff7b72] bg-[#261317] px-1.5 py-0.2 rounded border border-[#4a1c24]">
                -{parsed.stats.deletions} lines
              </span>
            </div>

            {/* Right Header: AFTER */}
            <div className="px-3 py-1.5 bg-[#091510] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Plus size={13} className="text-[#3fb950] font-bold" />
                <span className="font-bold text-[#3fb950] text-[11px] tracking-wide uppercase">
                  AFTER: Proposed Fix Patch
                </span>
              </div>
              <span className="text-[10px] text-[#3fb950] bg-[#0d1e17] px-1.5 py-0.2 rounded border border-[#1b3d2b]">
                +{parsed.stats.additions} lines
              </span>
            </div>
          </div>

          {/* Side-by-Side Content Container */}
          <div className="overflow-x-auto overflow-y-auto max-h-[520px] bg-[#05070a] divide-y divide-[#161f30]">
            {parsed.files.map((file, fIdx) => (
              <div key={fIdx}>
                {/* Multi-file header if more than one file */}
                {parsed.files.length > 1 && (
                  <div className="px-3 py-1 bg-[#0b0e17] border-y border-[#1b2234] font-mono text-[11px] text-[#58a6ff] flex items-center gap-2">
                    <FileDiff size={12} />
                    <span>{file.filename}</span>
                  </div>
                )}

                {file.hunks.map((hunk, hIdx) => (
                  <div key={hIdx}>
                    {/* Hunk Scope Line */}
                    <div className="px-3 py-1 bg-[#090d16] border-y border-[#161f30] font-mono text-[10px] text-[#58a6ff] flex items-center gap-2 select-none">
                      <span className="text-[#79c0ff]">{hunk.header}</span>
                      {hunk.contextTitle && (
                        <span className="text-[#6e7681] italic"># {hunk.contextTitle}</span>
                      )}
                    </div>

                    {/* Aligned Split Rows */}
                    <div className="divide-y divide-[#101522]">
                      {hunk.rows.map((row, rIdx) => {
                        const isDel = row.type === 'del' || (row.type === 'change' && row.left);
                        const isAdd = row.type === 'add' || (row.type === 'change' && row.right);
                        const isSame = row.type === 'same';

                        return (
                          <div key={rIdx} className="grid grid-cols-2 text-xs font-mono leading-relaxed">
                            {/* Left Column (BEFORE) */}
                            <div
                              className={`flex border-r border-[#1b2234] transition-colors ${
                                row.left && row.type !== 'same'
                                  ? 'bg-[#35151b]/70 text-[#ff7b72]'
                                  : isSame
                                  ? 'text-[#c9d1d9] hover:bg-[#0d111a]'
                                  : 'bg-[#080b12]/50 text-transparent select-none'
                              }`}
                            >
                              {/* Line Number */}
                              <span className="w-10 text-right pr-2 text-[#484f58] select-none text-[10px] shrink-0 border-r border-[#1b2234]/40 bg-[#07090f]/70 py-0.5">
                                {row.left?.num || ''}
                              </span>
                              {/* Sign Prefix */}
                              <span className="w-5 text-center font-bold text-[11px] select-none shrink-0 py-0.5 text-[#ff7b72]">
                                {row.left && row.type !== 'same' ? '-' : ''}
                              </span>
                              {/* Code Text */}
                              <span
                                className={`px-2 py-0.5 overflow-hidden whitespace-pre flex-1 text-[11px] ${
                                  wrapLines ? 'break-words whitespace-pre-wrap' : ''
                                }`}
                              >
                                {row.left?.text || ' '}
                              </span>
                            </div>

                            {/* Right Column (AFTER) */}
                            <div
                              className={`flex transition-colors ${
                                row.right && row.type !== 'same'
                                  ? 'bg-[#102c1c]/70 text-[#3fb950]'
                                  : isSame
                                  ? 'text-[#c9d1d9] hover:bg-[#0d111a]'
                                  : 'bg-[#080b12]/50 text-transparent select-none'
                              }`}
                            >
                              {/* Line Number */}
                              <span className="w-10 text-right pr-2 text-[#484f58] select-none text-[10px] shrink-0 border-r border-[#1b2234]/40 bg-[#07090f]/70 py-0.5">
                                {row.right?.num || ''}
                              </span>
                              {/* Sign Prefix */}
                              <span className="w-5 text-center font-bold text-[11px] select-none shrink-0 py-0.5 text-[#3fb950]">
                                {row.right && row.type !== 'same' ? '+' : ''}
                              </span>
                              {/* Code Text */}
                              <span
                                className={`px-2 py-0.5 overflow-hidden whitespace-pre flex-1 text-[11px] ${
                                  wrapLines ? 'break-words whitespace-pre-wrap' : ''
                                }`}
                              >
                                {row.right?.text || ' '}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: UNIFIED (INLINE CLASSIC DIFF) */}
      {viewMode === 'unified' && (
        <div className="p-3 bg-[#05070a] overflow-x-auto font-mono text-[11px] leading-relaxed max-h-[520px]">
          {textToDisplay.split('\n').map((line, idx) => {
            let lineClass = 'text-[#c9d1d9]';
            let bgClass = 'transparent';

            if (line.startsWith('+') && !line.startsWith('+++')) {
              lineClass = 'text-[#3fb950] font-medium';
              bgClass = 'rgba(46, 160, 67, 0.12)';
            } else if (line.startsWith('-') && !line.startsWith('---')) {
              lineClass = 'text-[#f85149] font-medium';
              bgClass = 'rgba(248, 81, 73, 0.12)';
            } else if (line.startsWith('@@')) {
              lineClass = 'text-[#58a6ff] font-semibold';
              bgClass = 'rgba(56, 139, 253, 0.08)';
            } else if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) {
              lineClass = 'text-[#8b949e] font-semibold';
            }

            return (
              <div
                key={idx}
                style={{ backgroundColor: bgClass }}
                className={`flex gap-3 px-2 py-0.5 rounded-xs ${lineClass}`}
              >
                <span className="text-[#484f58] select-none w-7 text-right font-mono text-[10px] shrink-0">
                  {idx + 1}
                </span>
                <span className="whitespace-pre">{line}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Info */}
      <div className="px-3.5 py-1.5 bg-[#0a0d14] border-t border-[#1b2234] text-[11px] font-mono text-[#6e7681] flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />
          <span>IDE Side-by-Side Diff Alignment Active</span>
        </span>
        <span>Verified by Worktree Sandbox</span>
      </div>
    </div>
  );
}
