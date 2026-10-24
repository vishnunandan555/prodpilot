import React, { useState } from 'react';
import { Copy, Check, FileDiff } from 'lucide-react';

export default function DiffViewer({ diff = '', diffText = '', filename = null }) {
  const [copied, setCopied] = useState(false);

  const textToDisplay = diff || diffText || '';

  const handleCopy = () => {
    navigator.clipboard.writeText(textToDisplay);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Dynamically extract filename from diff header if not passed explicitly
  const detectedFilename = (() => {
    if (filename) return filename;
    if (!textToDisplay) return 'patch.diff';
    const matchGit = textToDisplay.match(/diff --git a\/(.+?) b\//);
    if (matchGit) return matchGit[1];
    const matchPlus = textToDisplay.match(/\+\+\+ b\/(.+?)(\s|$)/);
    if (matchPlus) return matchPlus[1];
    return 'patch.diff';
  })();

  const lines = textToDisplay ? textToDisplay.split('\n') : [];

  return (
    <div className="border border-[#1b2234] rounded-lg overflow-hidden bg-[#07090f] text-[12px] shadow-sm">
      {/* Diff Header */}
      <div className="px-3.5 py-2 bg-[#0d111a] border-b border-[#1b2234] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileDiff size={14} className="text-[#58a6ff]" />
          <span className="font-mono font-semibold text-[#f0f6fc] text-xs">
            {detectedFilename}
          </span>
          <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-[#161f30] text-[#79c0ff] border border-[#263550]">
            verified patch
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="px-2.5 py-1 rounded bg-[#161b26] hover:bg-[#212a3d] text-[#c9d1d9] border border-[#212a3d] text-[11px] font-mono flex items-center gap-1 transition"
          title="Copy diff patch"
        >
          {copied ? <Check size={12} className="text-[#3fb950]" /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy Diff'}</span>
        </button>
      </div>

      {/* Diff Content */}
      <div className="p-3 bg-[#05070a] overflow-x-auto font-mono text-[11px] leading-relaxed max-h-[420px]">
        {lines.length === 0 ? (
          <div className="text-[#6e7681] text-center py-6">No diff content recorded.</div>
        ) : (
          lines.map((line, idx) => {
            let lineClass = 'text-[#c9d1d9]';
            let bgClass = 'transparent';

            if (line.startsWith('+') && !line.startsWith('+++')) {
              lineClass = 'text-[#3fb950] font-medium';
              bgClass = 'rgba(46, 160, 67, 0.12)';
            } else if (line.startsWith('-') && !line.startsWith('---')) {
              lineClass = 'text-[#f85149] font-medium';
              bgClass = 'rgba(248, 81, 73, 0.12)';
            } else if (line.startsWith('@@')) {
              lineClass = 'text-[#58a6ff]';
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
          })
        )}
      </div>
    </div>
  );
}
