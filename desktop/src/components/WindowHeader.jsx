import React from 'react';
import { User, LogOut, RefreshCw } from 'lucide-react';

export default function WindowHeader({
  apiConnected,
  currentUser,
  onLogout,
  onOpenAuth,
  onOpenProfile,
  isRefreshing = false
}) {
  return (
    <header className="h-9 px-3 bg-[#07090f] border-b border-[#1b2234] flex items-center justify-between select-none text-[12px] flex-shrink-0 z-20 font-sans">
      {/* Left: Branding */}
      <div className="flex items-center gap-2">
        <img
          src="/logo.png"
          alt="ProdPilot"
          className="w-4 h-4 rounded-sm object-contain"
        />
        <span className="font-semibold text-[#f0f6fc] tracking-tight">ProdPilot</span>
      </div>

      {/* Right: API Status & Operator Profile */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-[#8b949e]">
          {isRefreshing && (
            <span className="flex items-center gap-1.5 text-[#58a6ff] px-2 py-0.5 rounded bg-[#161f30] border border-[#263550] text-[10px] font-mono animate-in fade-in duration-150">
              <RefreshCw size={10} className="animate-spin" />
              <span className="hidden sm:inline">Syncing...</span>
            </span>
          )}
          {apiConnected ? (
            <span className="flex items-center gap-1.5 text-[#3fb950] px-2 py-0.5 rounded bg-[#0d1e17] border border-[#1b3d2b] text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />
              <span>System Online</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[#ff7b72] px-2 py-0.5 rounded bg-[#261317] border border-[#4a1c24] text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff7b72]" />
              <span>Backend Offline</span>
            </span>
          )}
        </div>

        {/* Operator Profile / Auth */}
        {currentUser ? (
          <div className="flex items-center gap-2 pl-2 border-l border-[#1b2234]">
            <button
              onClick={onOpenProfile}
              title="Manage Account Profile (Photo, Phone, Role)"
              className="flex items-center gap-1.5 p-1 rounded-md hover:bg-[#161f30] transition text-left"
            >
              <div className="w-5 h-5 rounded-full bg-[#171f30] border border-[#293652] overflow-hidden flex items-center justify-center text-[10px] font-semibold text-[#58a6ff]">
                {currentUser.avatar_url ? (
                  <img
                    src={currentUser.avatar_url}
                    alt={currentUser.username}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  (currentUser.username || 'A').charAt(0).toUpperCase()
                )}
              </div>
              <span className="text-xs text-[#c9d1d9] hover:text-[#58a6ff] hidden sm:inline font-medium">
                {currentUser.username}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#171f30] text-[#58a6ff] border border-[#293652] uppercase font-semibold">
                {currentUser.role || 'sre'}
              </span>
            </button>
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
      </div>
    </header>
  );
}
