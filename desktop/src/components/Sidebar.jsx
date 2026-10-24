import React, { useState, useCallback, useEffect } from 'react';
import {
  LayoutDashboard,
  ShieldAlert,
  Terminal,
  Server,
  FolderGit2,
  Cpu,
  Bot,
  Users,
  Settings,
  Trash2,
  Clock,
  Radio,
  Presentation
} from 'lucide-react';
import {
  formatIncidentId,
  formatStatusLabel,
  getStatusBadgeStyle,
  formatSeverityLabel,
  cleanIncidentTitle,
  formatRelativeTime,
  isIncidentActive,
  isIncidentInactive
} from '../utils/formatters';

const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 220;
const MAX_WIDTH = 480;

export default function Sidebar({
  activeNav,
  setActiveNav,
  incidents = [],
  activeIncident,
  onSelectIncident,
  apiConnected,
  incidentFilter = 'active',
  setIncidentFilter,
  isRefreshing = false,
  onDeleteIncident,
  onClearIncidents,
  isMobileScreen = false,
  apiUrl,
  onOpenVoiceModal
}) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const activeCount = incidents.filter((i) => isIncidentActive(i.status));

  // Draggable Sidebar Width with LocalStorage persistence
  const [width, setWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('prodpilot_sidebar_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
          return parsed;
        }
      }
    } catch {
      // fallback to default
    }
    return DEFAULT_WIDTH;
  });

  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (moveEvent) => {
      const currentMax = Math.min(MAX_WIDTH, Math.floor(window.innerWidth * 0.55));
      const newWidth = Math.min(Math.max(startWidth + (moveEvent.clientX - startX), MIN_WIDTH), currentMax);
      setWidth(newWidth);
    };

    const onMouseUp = (upEvent) => {
      setIsResizing(false);
      const currentMax = Math.min(MAX_WIDTH, Math.floor(window.innerWidth * 0.55));
      const finalWidth = Math.min(Math.max(startWidth + (upEvent.clientX - startX), MIN_WIDTH), currentMax);
      try {
        localStorage.setItem('prodpilot_sidebar_width', finalWidth.toString());
      } catch {}
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [width]);

  const resetWidth = useCallback(() => {
    setWidth(DEFAULT_WIDTH);
    try {
      localStorage.setItem('prodpilot_sidebar_width', DEFAULT_WIDTH.toString());
    } catch {}
  }, []);

  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  const filteredIncidents = incidents.filter((inc) => {
    if (incidentFilter === 'active') {
      return isIncidentActive(inc.status);
    }
    if (incidentFilter === 'resolved') {
      return isIncidentInactive(inc.status);
    }
    return true;
  });

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'incidents',
      label: 'Incidents',
      icon: ShieldAlert,
      badge: activeCount.length > 0 ? `${activeCount.length}` : null,
      badgeColor: 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]'
    },
    { id: 'logs', label: 'Logs', icon: Terminal },
    { id: 'servers', label: 'Servers', icon: Server },
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'services', label: 'Services', icon: Cpu },
    { id: 'agents', label: 'Agents', icon: Bot },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
    {
      id: 'demo',
      label: 'Demo',
      icon: Presentation,
      badge: 'SLIDES',
      badgeColor: 'bg-[#162033] text-[#58a6ff] border-[#233352]'
    },
  ];

  return (
    <aside
      style={{ width: isMobileScreen ? '100%' : `${width}px` }}
      className={`relative flex-shrink-0 bg-[#0d111a] border-r border-[#1b2234] flex flex-col h-full select-none text-[#c9d1d9] font-sans ${
        isResizing ? '' : 'transition-[width] duration-150 ease-out'
      }`}
    >
      {/* Primary Navigation Items */}
      <div className="p-2 space-y-0.5 border-b border-[#1b2234]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activeNav === item.id ||
            (item.id === 'projects' && activeNav === 'repositories');
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveNav(item.id);
                if (item.id === 'incidents' && onSelectIncident) {
                  onSelectIncident(null);
                }
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition ${
                isActive
                  ? 'bg-[#171f30] text-[#f0f6fc] font-semibold border border-[#293652]'
                  : 'text-[#8b949e] hover:bg-[#121824] hover:text-[#c9d1d9] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  size={15}
                  className={
                    isActive
                      ? 'text-[#58a6ff]'
                      : item.id === 'incidents' && activeCount.length > 0
                      ? 'text-[#ff7b72]'
                      : 'text-[#6e7681]'
                  }
                />
                <span>{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5">
                {item.badge && !isActive && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold border ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Incident Sub-list */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="px-3 pt-3 pb-2 flex items-center justify-between border-b border-[#1b2234] gap-1.5">
          <div className="flex items-center gap-1.5 text-xs text-[#8b949e] shrink-0">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-[#6e7681]">
              Incidents
            </span>
            <span className="text-[11px] font-mono">
              ({incidentFilter === 'active' ? activeCount.length : filteredIncidents.length})
            </span>
            {incidents.length > 0 && onClearIncidents && (
              confirmClear ? (
                <span className="flex items-center gap-1 text-[10px] ml-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClearIncidents("RESOLVED");
                      setConfirmClear(false);
                    }}
                    className="text-[#ff7b72] hover:underline font-semibold"
                  >
                    Clear?
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="text-[#8b949e] hover:underline"
                  >
                    ✕
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="p-1 rounded text-[#6e7681] hover:text-[#ff7b72] hover:bg-[#261317] transition ml-0.5"
                  title="Clear resolved incidents"
                >
                  <Trash2 size={11} />
                </button>
              )
            )}
          </div>

          <div className="flex items-center bg-[#07090f] rounded p-0.5 border border-[#1b2234] shrink-0">
            {['all', 'active', 'resolved'].map((f) => (
              <button
                key={f}
                onClick={() => setIncidentFilter(f)}
                className={`px-2 py-0.5 rounded text-[10px] capitalize font-medium transition ${
                  incidentFilter === f
                    ? 'bg-[#1f293d] text-[#f0f6fc] font-semibold'
                    : 'text-[#6e7681] hover:text-[#c9d1d9]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Incident Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {isRefreshing && incidents.length === 0 ? (
            <div className="space-y-2 p-1 animate-in fade-in duration-200">
              <div className="h-14 rounded-md bg-[#161f30]/60 animate-pulse border border-[#1b2234]" />
              <div className="h-14 rounded-md bg-[#161f30]/40 animate-pulse border border-[#1b2234]" />
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="py-8 text-center text-[#6e7681] text-xs">
              No {incidentFilter === 'all' ? '' : incidentFilter} incidents
            </div>
          ) : (
            filteredIncidents.map((inc) => {
              const isSelected = activeIncident?.id === inc.id && activeNav === 'incidents';
              const isResolved = isIncidentInactive(inc.status);

              return (
                <div
                  key={inc.id}
                  onClick={() => {
                    onSelectIncident(inc);
                    setActiveNav('incidents');
                  }}
                  className={`group w-full text-left p-2.5 rounded-lg transition border text-xs space-y-1.5 block cursor-pointer select-none ${
                    isSelected
                      ? 'bg-[#151c2b] border-[#388bfd] text-[#f0f6fc] shadow-sm'
                      : 'bg-[#090d16] border-[#1b2234] hover:bg-[#111724] text-[#8b949e]'
                  }`}
                >
                  {/* Row 1: Short ID + Status Badge */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-mono font-bold text-[#58a6ff] shrink-0">
                        {formatIncidentId(inc.id)}
                      </span>
                      <span className="text-[11px] font-mono text-[#8b949e] truncate">
                        {inc.service || 'service'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-medium border whitespace-nowrap ${getStatusBadgeStyle(
                          inc.status
                        )}`}
                      >
                        {formatStatusLabel(inc.status)}
                      </span>
                      {onDeleteIncident && (
                        confirmDeleteId === inc.id ? (
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteIncident(inc.id);
                                setConfirmDeleteId(null);
                              }}
                              className="text-[9px] px-1 py-0.5 rounded bg-[#da3633] text-white font-medium hover:bg-[#f85149]"
                              title="Confirm delete"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[9px] px-1 py-0.5 rounded text-[#8b949e] hover:text-[#c9d1d9]"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(inc.id);
                            }}
                            className="p-0.5 rounded text-[#6e7681] hover:text-[#ff7b72] hover:bg-[#261317] transition opacity-0 group-hover:opacity-100"
                            title="Delete incident record"
                          >
                            <Trash2 size={11} />
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Row 2: Title */}
                  <div className="text-xs text-[#c9d1d9] line-clamp-1 leading-snug font-medium">
                    {cleanIncidentTitle(inc)}
                  </div>

                  {/* Row 3: Severity & Relative Time */}
                  <div className="text-[10px] text-[#6e7681] flex items-center justify-between pt-0.5 border-t border-[#161d2d]">
                    <span className={`font-semibold ${
                      (inc.severity || '').toUpperCase().includes('LOW')
                        ? 'text-[#f0883e]'
                        : (inc.severity || '').toUpperCase().includes('MEDIUM')
                        ? 'text-[#e3b341]'
                        : 'text-[#ff7b72]'
                    }`}>
                      {formatSeverityLabel(inc.severity)}
                    </span>
                    <span className="flex items-center gap-1 text-[#8b949e]">
                      <Clock size={10} />
                      {formatRelativeTime(inc.detected_at || inc.created_at)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Docked Platform Master Log at Bottom */}
      <div className="p-2 border-t border-[#1b2234] bg-[#090d16]">
        <button
          onClick={() => setActiveNav('master_logs')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-mono font-medium transition ${
            activeNav === 'master_logs'
              ? 'bg-[#171f30] text-[#f0f6fc] font-semibold border border-[#293652]'
              : 'text-[#8b949e] hover:bg-[#121824] hover:text-[#c9d1d9] border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Terminal
              size={14}
              className={activeNav === 'master_logs' ? 'text-[#58a6ff]' : 'text-[#6e7681]'}
            />
            <span className="font-sans text-xs">System Audit Log</span>
          </div>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse" />
            <span className="text-[10px] text-[#6e7681]">LIVE</span>
          </span>
        </button>
      </div>

      {/* Footer Info */}
      <div className="px-3 py-2 border-t border-[#1b2234] bg-[#07090f] text-xs text-[#6e7681] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <img src="/logo.png" alt="ProdPilot" className="w-3.5 h-3.5 rounded-sm object-contain" />
          <span className="text-[11px] font-medium text-[#c9d1d9]">ProdPilot</span>
        </div>
        <span className={`text-[11px] flex items-center gap-1 ${apiConnected ? 'text-[#3fb950]' : 'text-[#ff7b72]'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${apiConnected ? 'bg-[#3fb950]' : 'bg-[#ff7b72]'}`} />
          {apiConnected ? 'Connected' : 'Offline'}
        </span>
      </div>

      {/* Draggable Resizer Splitter Border */}
      {!isMobileScreen && (
        <div
          onMouseDown={startResizing}
          onDoubleClick={resetWidth}
          className={`absolute top-0 right-0 w-2 h-full cursor-col-resize z-30 group flex items-center justify-center select-none ${
            isResizing ? 'bg-[#388bfd]/25' : 'hover:bg-[#388bfd]/10'
          }`}
          title="Drag to resize sidebar • Double-click to reset (280px)"
        >
          {/* Highlight accent line */}
          <div
            className={`w-[2px] h-full transition-colors ${
              isResizing
                ? 'bg-[#58a6ff] shadow-[0_0_8px_rgba(88,166,255,0.7)]'
                : 'bg-transparent group-hover:bg-[#388bfd]/60'
            }`}
          />
          {/* Visual grab pill at vertical center */}
          <div
            className={`absolute w-1 h-7 rounded-full transition-all ${
              isResizing
                ? 'bg-[#58a6ff] opacity-100 scale-y-110 shadow-[0_0_6px_#58a6ff]'
                : 'bg-[#58a6ff]/70 opacity-0 group-hover:opacity-100'
            }`}
          />
        </div>
      )}
    </aside>
  );
}
