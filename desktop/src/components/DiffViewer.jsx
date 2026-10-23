import React, { useState } from 'react';
import { Copy, Check, FileDiff } from 'lucide-react';

export default function DiffViewer({ diff = '', diffText = '' }) {
  const [copied, setCopied] = useState(false);

  const textToDisplay = diff || diffText || '';

  const handleCopy = () => {
    navigator.clipboard.writeText(textToDisplay);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = textToDisplay ? textToDisplay.split('\n') : [];

  return (
    <div className="border border-gh-border rounded-md overflow-hidden bg-gh-surface text-[12px]">
      {/* Diff Header */}
      <div className="px-3 py-2 bg-gh-subtle border-b border-gh-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileDiff size={14} className="text-gh-text-muted" />
          <span className="font-semibold text-gh-text-bright">app.py</span>
          <span className="text-[11px] font-mono text-gh-text-dim">
            demo-prod
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="gh-btn-secondary px-2 py-0.5 text-[11px] flex items-center gap-1"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Diff Content */}
      <div className="p-3 bg-gh-inset overflow-x-auto font-mono text-[11px] leading-relaxed max-h-[380px]">
        {lines.length === 0 ? (
          <div className="text-gh-text-dim text-center py-6">No diff content.</div>
        ) : (
          lines.map((line, idx) => {
            let lineClass = 'text-gh-text';
            let bgClass = 'transparent';

            if (line.startsWith('+') && !line.startsWith('+++')) {
              lineClass = 'text-[#3fb950]';
              bgClass = 'rgba(46, 160, 67, 0.15)';
            } else if (line.startsWith('-') && !line.startsWith('---')) {
              lineClass = 'text-[#f85149]';
              bgClass = 'rgba(248, 81, 73, 0.15)';
            } else if (line.startsWith('@@')) {
              lineClass = 'text-[#58a6ff]';
              bgClass = 'rgba(56, 139, 253, 0.1)';
            } else if (line.startsWith('diff --git') || line.startsWith('index ')) {
              lineClass = 'text-gh-text-muted font-semibold';
            }

            return (
              <div
                key={idx}
                style={{ backgroundColor: bgClass }}
                className={`flex gap-2.5 px-2 py-0.5 rounded-sm ${lineClass}`}
              >
                <span className="text-gh-text-dim select-none w-6 text-right font-mono text-[10px]">
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
