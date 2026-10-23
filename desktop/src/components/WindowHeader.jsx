import React from 'react';
import {
  Flame,
  RotateCcw,
  Wifi,
  WifiOff,
  Minimize2,
  Square,
  X,
  User,
  LogOut
} from 'lucide-react';

export default function WindowHeader({
  apiConnected,
  onTriggerCrash,
  onResetDemo,
  isRefreshing,
  currentUser,
  onLogout,
  onOpenAuth
}) {
  return (
    <header className="h-9 px-3 bg-[#07090f] border-b border-[#1b2234] flex items-center justify-between select-none text-[12px] flex-shrink-0 z-20 font-sans">
      {/* Left: Window Identity / Branding */}
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-[#1f293d] border border-[#2e3d5b] flex items-center justify-center text-[9px] font-bold font-mono text-[#f0f6fc]">
          P
        </div>
        <span className="font-semibold text-[#f0f6fc] tracking-tight">ProdPilot</span>
        <span className="text-[#485263]">·</span>
        <span className="text-[#8b949e] font-mono text-[11px]">Autonomous SRE & Developer Workspace</span>
      </div>

      {/* Center: Live Demo Quick Action Controls */}
      <div className="flex items-center gap-2 font-mono">
        <button
          onClick={onTriggerCrash}
          className="px-2.5 py-0.5 rounded text-[11px] bg-[#211517] hover:bg-[#34181c] text-[#ff7b72] border border-[#4a1c24] flex items-center gap-1.5 transition"
          title="Simulate 500 error on /orders"
        >
          <Flame size={12} className="text-[#ff7b72]" />
          <span>Trigger Crash</span>
        </button>

        <button
          onClick={onResetDemo}
          className="px-2.5 py-0.5 rounded text-[11px] bg-[#171f30] hover:bg-[#1f293d] text-[#c9d1d9] border border-[#293652] flex items-center gap-1.5 transition"
          title="Restore clean baseline on port 8000"
        >
          <RotateCcw size={11} className={isRefreshing ? 'animate-spin' : ''} />
          <span>Reset Demo</span>
        </button>
      </div>

      {/* Right: Backend API Status & Native Linux Window Controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#8b949e]">
          {apiConnected ? (
            <span className="flex items-center gap-1 text-[#3fb950] px-1.5 py-0.2 rounded bg-[#0d1e17] border border-[#1b3d2b]">
              <Wifi size={11} /> 8765
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[#ff7b72] px-1.5 py-0.2 rounded bg-[#261317] border border-[#4a1c24]">
              <WifiOff size={11} /> Offline
            </span>
          )}
        </div>

        {/* Operator Profile / Auth */}
        {currentUser ? (
          <div className="flex items-center gap-1.5 pl-2 border-l border-[#1b2234]">
            <div className="w-4 h-4 rounded-full bg-[#171f30] border border-[#293652] flex items-center justify-center text-[9px] font-bold text-[#58a6ff]">
              {(currentUser.username || 'A').charAt(0).toUpperCase()}
            </div>
            <span className="text-[11px] font-mono text-[#c9d1d9] hidden sm:inline">
              {currentUser.username}
            </span>
            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#171f30] text-[#58a6ff] border border-[#293652] uppercase">
              {currentUser.role || 'sre'}
            </span>
            <button
              onClick={onLogout}
              className="text-[#6e7681] hover:text-[#ff7b72] transition ml-0.5"
              title="Sign Out"
            >
              <LogOut size={11} />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="px-2 py-0.5 rounded bg-[#171f30] hover:bg-[#1f293d] border border-[#293652] text-[#58a6ff] text-[11px] font-mono flex items-center gap-1"
          >
            <User size={11} />
            <span>Sign In</span>
          </button>
        )}

        {/* Linux Window Minimizer/Maximizer Icons */}
        <div className="flex items-center gap-2 text-[#8b949e] pl-2 border-l border-[#1b2234]">
          <button className="hover:text-[#f0f6fc] transition-colors" title="Minimize">
            <Minimize2 size={11} />
          </button>
          <button className="hover:text-[#f0f6fc] transition-colors" title="Maximize">
            <Square size={10} />
          </button>
          <button className="hover:text-[#ff7b72] transition-colors" title="Close">
            <X size={12} />
          </button>
        </div>
      </div>
    </header>
  );
}
