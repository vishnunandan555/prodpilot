import React from 'react';
import { GitPullRequest, Copy, Check, FileDiff } from 'lucide-react';

export default function DiffViewer({ diffText = '' }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(diffText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = diffText ? diffText.split('\n') : [];

  return (
    <div className="glass-panel overflow-hidden border border-white/10">
      {/* Diff Header */}
      <div className="px-4 py-2.5 bg-black/40 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileDiff className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-slate-200">Generated Fix Patch Diff</span>
          <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
            demo-prod / app.py
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded transition-all"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy Diff'}</span>
        </button>
      </div>

      {/* Diff Content */}
      <div className="p-4 bg-[#050811] overflow-x-auto text-xs font-mono leading-relaxed max-h-[460px]">
        {lines.length === 0 ? (
          <div className="text-slate-500 text-center py-8">No patch diff generated yet.</div>
        ) : (
          lines.map((line, idx) => {
            let lineClass = 'text-slate-300';
            let bgClass = 'transparent';

            if (line.startsWith('+') && !line.startsWith('+++')) {
              lineClass = 'text-emerald-400 font-semibold';
              bgClass = 'rgba(16, 185, 129, 0.12)';
            } else if (line.startsWith('-') && !line.startsWith('---')) {
              lineClass = 'text-rose-400 font-semibold';
              bgClass = 'rgba(244, 63, 94, 0.12)';
            } else if (line.startsWith('@@')) {
              lineClass = 'text-sky-400 font-bold';
              bgClass = 'rgba(14, 165, 233, 0.1)';
            } else if (line.startsWith('diff --git') || line.startsWith('index ')) {
              lineClass = 'text-indigo-300 font-semibold';
            }

            return (
              <div
                key={idx}
                style={{ backgroundColor: bgClass }}
                className={`flex gap-3 px-2 py-0.5 rounded-sm hover:brightness-110 ${lineClass}`}
              >
                <span className="text-slate-600 select-none w-8 text-right font-mono text-[11px]">
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
