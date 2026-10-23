import React from 'react';
import {
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
  currentUser,
  onLogout,
  onOpenAuth
}) {
  return (
    <header className="h-9 px-3 bg-[#07090f] border-b border-[#1b2234] flex items-center justify-between select-none text-[12px] flex-shrink-0 z-20 font-sans">
      {/* Left: Branding */}
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-[#1f293d] border border-[#2e3d5b] flex items-center justify-center text-[10px] font-bold font-mono text-[#f0f6fc]">
          P
        </div>
        <span className="font-semibold text-[#f0f6fc] tracking-tight">ProdPilot</span>
      </div>

      {/* Right: API Status & Operator Profile */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-[#8b949e]">
          {apiConnected ? (
            <span className="flex items-center gap-1.5 text-[#3fb950] px-2 py-0.5 rounded bg-[#0d1e17] border border-[#1b3d2b] text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />
              <span>Connected</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[#ff7b72] px-2 py-0.5 rounded bg-[#261317] border border-[#4a1c24] text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff7b72]" />
              <span>Daemon Offline</span>
            </span>
          )}
        </div>

        {/* Operator Profile / Auth */}
        {currentUser ? (
          <div className="flex items-center gap-2 pl-2 border-l border-[#1b2234]">
            <div className="w-5 h-5 rounded-full bg-[#171f30] border border-[#293652] flex items-center justify-center text-[10px] font-semibold text-[#58a6ff]">
              {(currentUser.username || 'A').charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-[#c9d1d9] hidden sm:inline font-medium">
              {currentUser.username}
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#171f30] text-[#58a6ff] border border-[#293652] uppercase font-semibold">
              {currentUser.role || 'sre'}
            </span>
            <button
              onClick={onLogout}
              className="text-[#6e7681] hover:text-[#ff7b72] transition ml-0.5 p-0.5 rounded hover:bg-[#161b26]"
              title="Sign Out"
            >
              <LogOut size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="px-2.5 py-1 rounded bg-[#171f30] hover:bg-[#1f293d] border border-[#293652] text-[#58a6ff] text-xs font-medium flex items-center gap-1.5"
          >
            <User size={12} />
            <span>Sign In</span>
          </button>
        )}

        {/* Window Controls */}
        <div className="flex items-center gap-2 text-[#8b949e] pl-2 border-l border-[#1b2234]">
          <button className="hover:text-[#f0f6fc] transition-colors p-1 rounded hover:bg-[#161b26]" title="Minimize">
            <Minimize2 size={11} />
          </button>
          <button className="hover:text-[#f0f6fc] transition-colors p-1 rounded hover:bg-[#161b26]" title="Maximize">
            <Square size={10} />
          </button>
          <button className="hover:text-[#ff7b72] transition-colors p-1 rounded hover:bg-[#161b26]" title="Close">
            <X size={12} />
          </button>
        </div>
      </div>
    </header>
  );
}
