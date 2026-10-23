import React from 'react';
import {
  Flame,
  RotateCcw,
  Wifi,
  WifiOff,
  Minimize2,
  Square,
  X
} from 'lucide-react';

export default function WindowHeader({
  apiConnected,
  onTriggerCrash,
  onResetDemo,
  isRefreshing
}) {
  return (
    <header className="h-9 px-3 bg-gh-inset border-b border-gh-border flex items-center justify-between select-none text-[12px] flex-shrink-0 z-20">
      {/* Left: Window Identity / Branding */}
      <div className="flex items-center gap-2">
        <div className="w-3.5 h-3.5 rounded-full bg-gh-border flex items-center justify-center text-[8px] font-bold text-gh-text-bright">
          P
        </div>
        <span className="font-semibold text-gh-text-bright tracking-tight">GitHub Copilot</span>
        <span className="text-gh-text-dim">·</span>
        <span className="text-gh-text-muted font-mono text-[11px]">ProdPilot Desktop (Linux)</span>
      </div>

      {/* Center: Live Demo Quick Action Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onTriggerCrash}
          className="gh-btn-danger px-2.5 py-0.5 text-[11px] flex items-center gap-1.5"
          title="Simulate 500 error on /orders"
        >
          <Flame size={12} className="text-red-400" />
          <span>Trigger Crash</span>
        </button>

        <button
          onClick={onResetDemo}
          className="gh-btn-secondary px-2.5 py-0.5 text-[11px] flex items-center gap-1.5"
          title="Restore clean baseline on port 8000"
        >
          <RotateCcw size={11} className={isRefreshing ? 'animate-spin' : ''} />
          <span>Reset Demo</span>
        </button>
      </div>

      {/* Right: Backend API Status & Native Linux Window Controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-gh-text-dim">
          {apiConnected ? (
            <span className="flex items-center gap-1 text-emerald-400">
              <Wifi size={11} /> 8765
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-400">
              <WifiOff size={11} /> Offline
            </span>
          )}
        </div>

        {/* Linux Window Minimizer/Maximizer Icons */}
        <div className="flex items-center gap-2 text-gh-text-muted pl-2 border-l border-gh-border">
          <button className="hover:text-gh-text-bright transition-colors" title="Minimize">
            <Minimize2 size={11} />
          </button>
          <button className="hover:text-gh-text-bright transition-colors" title="Maximize">
            <Square size={10} />
          </button>
          <button className="hover:text-red-400 transition-colors" title="Close">
            <X size={12} />
          </button>
        </div>
      </div>
    </header>
  );
}
