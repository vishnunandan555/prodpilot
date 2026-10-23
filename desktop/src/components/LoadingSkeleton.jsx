import React from 'react';

/**
 * Ambient Top Progress Bar
 * Rendered at the very top of the window when any background sync / fetch is active.
 */
export function GlobalProgressBar({ active = false }) {
  if (!active) return null;
  return (
    <div className="fixed top-0 left-0 right-0 h-[2px] z-50 overflow-hidden bg-transparent pointer-events-none">
      <div className="h-full bg-gradient-to-r from-transparent via-[#58a6ff] to-[#3fb950] w-full top-progress-bar shadow-[0_0_8px_#58a6ff]" />
    </div>
  );
}

/**
 * Shimmer Box Helper
 */
export function Shimmer({ className = '', style = {} }) {
  return (
    <div
      className={`shimmer-bg rounded ${className}`}
      style={style}
    />
  );
}

/**
 * Sleek Centered Loading View
 */
export function ViewSpinner({ message = 'Loading production telemetry...' }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-8 space-y-3.5 text-center animate-in fade-in duration-200">
      <div className="relative">
        <div className="w-9 h-9 rounded-xl bg-[#161f30] border border-[#263550] flex items-center justify-center text-[#58a6ff] shadow-lg shadow-[#58a6ff]/10">
          <span className="w-4 h-4 border-2 border-white/20 border-t-[#58a6ff] rounded-full animate-spin" />
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#3fb950] animate-ping" />
      </div>
      <div>
        <p className="text-xs font-semibold text-[#f0f6fc] tracking-tight">{message}</p>
        <p className="text-[11px] text-[#6e7681] mt-0.5 font-mono">Syncing with ProdPilot SRE engine</p>
      </div>
    </div>
  );
}

/**
 * Stat Cards Grid Skeleton (4 cards)
 */
export function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="p-3.5 rounded-xl bg-[#0e1422] border border-[#1b253b] space-y-2.5 animate-pulse"
        >
          <div className="flex items-center justify-between">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-4 w-4 rounded-full" />
          </div>
          <Shimmer className="h-6 w-16" />
          <Shimmer className="h-2.5 w-24" />
        </div>
      ))}
    </div>
  );
}

/**
 * List / Card Skeleton
 */
export function ListItemSkeleton({ count = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-3 rounded-lg bg-[#0d131f] border border-[#1a2438] flex items-center justify-between animate-pulse"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Shimmer className="w-7 h-7 rounded-lg shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <Shimmer className="h-3 w-1/3" />
              <Shimmer className="h-2 w-1/2" />
            </div>
          </div>
          <Shimmer className="h-5 w-16 rounded shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * Log Stream Skeleton
 */
export function LogStreamSkeleton({ lines = 8 }) {
  const widths = ['75%', '90%', '60%', '85%', '70%', '95%', '65%', '80%'];
  return (
    <div className="space-y-2 p-3 bg-[#05070c] rounded-lg border border-[#171f30]">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Shimmer className="h-2.5 w-16 shrink-0" />
          <Shimmer className="h-2.5 w-10 shrink-0" />
          <Shimmer
            className="h-2.5"
            style={{ width: widths[i % widths.length] }}
          />
        </div>
      ))}
    </div>
  );
}
