import React from 'react';
import {
  LayoutDashboard,
  ShieldAlert,
  Terminal,
  Server,
  GitBranch,
  Bot,
  Users,
  Settings,
  ChevronRight,
  Filter
} from 'lucide-react';

export default function Sidebar({
  activeNav,
  setActiveNav,
  incidents = [],
  activeIncident,
  onSelectIncident,
  apiConnected,
  apiBaseUrl,
  incidentFilter = 'all',
  setIncidentFilter
}) {
  const activeCount = incidents.filter(
    (i) => i.status !== 'RESOLVED' && i.status !== 'DEPLOYED' && i.status !== 'ROLLED_BACK'
  );

  const filteredIncidents = incidents.filter((inc) => {
    if (incidentFilter === 'active') {
      return inc.status !== 'RESOLVED' && inc.status !== 'DEPLOYED' && inc.status !== 'ROLLED_BACK';
    }
    if (incidentFilter === 'resolved') {
      return inc.status === 'RESOLVED' || inc.status === 'DEPLOYED' || inc.status === 'ROLLED_BACK';
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
    { id: 'logs', label: 'Logs Explorer', icon: Terminal },
    { id: 'services', label: 'Services', icon: Server, statusDot: activeCount.length > 0 ? 'bg-[#d29922]' : 'bg-[#3fb950]' },
    { id: 'repositories', label: 'Repositories', icon: GitBranch },
    { id: 'agents', label: 'Agents', icon: Bot, badge: '5', badgeColor: 'bg-[#121929] text-[#58a6ff] border-[#1d2d47]' },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-[240px] flex-shrink-0 bg-[#0d111a] border-r border-[#1b2234] flex flex-col h-full select-none text-[#c9d1d9]">
      {/* Brand & Workspace Title - Matte SRE Header */}
      <div className="h-11 px-3 border-b border-[#1b2234] flex items-center justify-between text-[#8b949e]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-[#1f293d] border border-[#2e3d5b] flex items-center justify-center text-white text-[10px] font-bold font-mono">
            P
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-semibold text-[#f0f6fc] tracking-tight">ProdPilot</span>
            <span className="text-[10px] text-[#485263] font-mono">v2.2</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-[#07090f] border border-[#1b2234]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              apiConnected ? 'bg-[#3fb950]' : 'bg-[#f85149]'
            }`}
          />
          <span className="text-[9px] font-mono text-[#8b949e]">
            {apiConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* 8 Primary Navigation Items */}
      <div className="p-1.5 space-y-0.5 border-b border-[#1b2234]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition ${
                isActive
                  ? 'bg-[#171f30] text-[#f0f6fc] font-medium border border-[#293652]'
                  : 'text-[#8b949e] hover:bg-[#121824] hover:text-[#c9d1d9] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon
                  size={14}
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
                {item.statusDot && !isActive && (
                  <span className={`w-1.5 h-1.5 rounded-full ${item.statusDot}`} />
                )}
                {item.badge && !isActive && (
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-mono border ${item.badgeColor}`}
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
        <div className="px-2.5 pt-2.5 pb-1.5 flex items-center justify-between border-b border-[#1b2234]">
          <div className="flex items-center gap-1 text-[10px] font-mono text-[#8b949e]">
            <span className="font-semibold uppercase tracking-wider text-[9px] text-[#6e7681]">
              INCIDENTS
            </span>
            <span>({incidents.length})</span>
          </div>

          <div className="flex items-center bg-[#07090f] rounded p-0.5 border border-[#1b2234]">
            {['all', 'active', 'resolved'].map((f) => (
              <button
                key={f}
                onClick={() => setIncidentFilter(f)}
                className={`px-1.5 py-0.2 rounded text-[9px] font-mono capitalize transition ${
                  incidentFilter === f
                    ? 'bg-[#1f293d] text-[#f0f6fc] font-bold'
                    : 'text-[#6e7681] hover:text-[#c9d1d9]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Incident Items */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
          {filteredIncidents.length === 0 ? (
            <div className="p-3 text-center text-[#485263] text-xs font-mono">
              No {incidentFilter} incidents
            </div>
          ) : (
            filteredIncidents.map((inc) => {
              const isSelected = activeIncident?.id === inc.id && activeNav === 'incidents';
              const isPending =
                inc.status !== 'RESOLVED' &&
                inc.status !== 'DEPLOYED' &&
                inc.status !== 'ROLLED_BACK';

              return (
                <button
                  key={inc.id}
                  onClick={() => {
                    onSelectIncident(inc);
                    setActiveNav('incidents');
                  }}
                  className={`w-full text-left p-2 rounded transition border font-mono text-xs space-y-0.5 block ${
                    isSelected
                      ? 'bg-[#151c2b] border-[#388bfd] text-[#f0f6fc]'
                      : 'bg-[#090d16] border-[#1b2234] hover:bg-[#111724] text-[#8b949e]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#58a6ff]">
                      {inc.id}
                    </span>
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase border ${
                        isPending
                          ? 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]'
                          : 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]'
                      }`}
                    >
                      {inc.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#c9d1d9] line-clamp-1 leading-snug">
                    {inc.title || inc.suspected_area || 'Production Outage'}
                  </div>
                  <div className="text-[9px] text-[#485263] flex items-center justify-between pt-0.5">
                    <span>{inc.service || 'demo-prod'}</span>
                    <span className="text-[#e3b341]">SEV-1</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-2 border-t border-[#1b2234] bg-[#07090f] text-[10px] font-mono text-[#485263] flex items-center justify-between">
        <span>Model 1</span>
        <span className="text-[#3fb950]">Tunnel Active</span>
      </div>
    </aside>
  );
}
