import React from 'react';
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
    { id: 'servers', label: 'Production Servers', icon: Server },
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'services', label: 'Platform Services', icon: Cpu },
    { id: 'agents', label: 'Agents', icon: Bot },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-[#0d111a] border-r border-[#1b2234] flex flex-col h-full select-none text-[#c9d1d9] font-sans">
      {/* 8 Primary Navigation Items */}
      <div className="p-2 space-y-0.5 border-b border-[#1b2234]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activeNav === item.id ||
            (item.id === 'projects' && activeNav === 'repositories');
          return (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
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
                {item.statusDot && !isActive && (
                  <span className={`w-1.5 h-1.5 rounded-full ${item.statusDot}`} />
                )}
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
        <div className="px-3 pt-3 pb-2 flex items-center justify-between border-b border-[#1b2234]">
          <div className="flex items-center gap-1.5 text-xs text-[#8b949e]">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-[#6e7681]">
              Incidents
            </span>
            <span className="text-[11px] font-mono">({incidents.length})</span>
          </div>

          <div className="flex items-center bg-[#07090f] rounded p-0.5 border border-[#1b2234]">
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
          {filteredIncidents.length === 0 ? (
            <div className="py-8 text-center text-[#6e7681] text-xs">
              No {incidentFilter === 'all' ? '' : incidentFilter} incidents
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
                  className={`w-full text-left p-2.5 rounded-md transition border text-xs space-y-1 block ${
                    isSelected
                      ? 'bg-[#151c2b] border-[#388bfd] text-[#f0f6fc]'
                      : 'bg-[#090d16] border-[#1b2234] hover:bg-[#111724] text-[#8b949e]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-[#58a6ff]">
                      {inc.id}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase border ${
                        isPending
                          ? 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]'
                          : 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]'
                      }`}
                    >
                      {inc.status}
                    </span>
                  </div>
                  <div className="text-xs text-[#c9d1d9] line-clamp-1 leading-snug font-medium">
                    {inc.title || inc.suspected_area || 'Production Outage'}
                  </div>
                  <div className="text-[10px] text-[#6e7681] flex items-center justify-between pt-0.5">
                    <span>{inc.service || 'Service Endpoint'}</span>
                    <span className="text-[#e3b341] font-semibold">{inc.severity || 'SEV-1'}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-3 py-2 border-t border-[#1b2234] bg-[#07090f] text-xs text-[#6e7681] flex items-center justify-between">
        <span>Production Workspace</span>
        <span className={apiConnected ? 'text-[#3fb950]' : 'text-[#ff7b72]'}>
          {apiConnected ? '● Online' : '○ Offline'}
        </span>
      </div>
    </aside>
  );
}
