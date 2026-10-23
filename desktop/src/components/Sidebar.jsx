import React from 'react';
import {
  ShieldAlert,
  Activity,
  Settings,
  Server,
  GitBranch,
  Flame,
  CheckCircle2,
  Clock,
  Radio,
  ExternalLink,
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
  ).length;

  const resolvedCount = incidents.filter(
    (i) => i.status === 'RESOLVED' || i.status === 'DEPLOYED' || i.status === 'ROLLED_BACK'
  ).length;

  const filteredIncidents = incidents.filter((inc) => {
    if (incidentFilter === 'active') {
      return inc.status !== 'RESOLVED' && inc.status !== 'DEPLOYED' && inc.status !== 'ROLLED_BACK';
    }
    if (incidentFilter === 'resolved') {
      return inc.status === 'RESOLVED' || inc.status === 'DEPLOYED' || inc.status === 'ROLLED_BACK';
    }
    return true;
  });

  return (
    <aside className="w-[280px] flex-shrink-0 bg-gh-surface border-r border-gh-border flex flex-col h-full select-none">
      {/* Brand & Workspace Title */}
      <div className="h-12 px-4 border-b border-gh-border flex items-center justify-between text-gh-text-muted">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-indigo-500/30">
            P
          </div>
          <div>
            <div className="text-[13px] font-bold text-gh-text-bright leading-none">ProdPilot</div>
            <div className="text-[10px] text-gh-text-dim mt-0.5 font-mono">Autonomous SRE</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              apiConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="text-[11px] font-mono text-gh-text-dim">
            {apiConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Streamlined Primary Navigation: Incidents, Telemetry & Logs, Settings */}
      <div className="p-2 space-y-1 border-b border-gh-border">
        {/* 1. Incidents */}
        <button
          onClick={() => setActiveNav('incidents')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
            activeNav === 'incidents'
              ? 'bg-gh-subtle text-gh-text-bright border border-gh-blue-border'
              : 'text-gh-text hover:bg-gh-subtle hover:text-gh-text-bright'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <ShieldAlert
              size={16}
              className={activeCount > 0 ? 'text-amber-400 animate-pulse' : 'text-gh-text-muted'}
            />
            <span>Incidents</span>
          </div>
          <div className="flex items-center gap-1.5">
            {activeCount > 0 && (
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-red-950/80 text-red-400 border border-red-800 font-mono font-semibold">
                {activeCount} active
              </span>
            )}
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-gh-border text-gh-text-muted font-mono">
              {incidents.length}
            </span>
          </div>
        </button>

        {/* 2. Telemetry & Logs */}
        <button
          onClick={() => setActiveNav('telemetry')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
            activeNav === 'telemetry'
              ? 'bg-gh-subtle text-gh-text-bright border border-gh-blue-border'
              : 'text-gh-text hover:bg-gh-subtle hover:text-gh-text-bright'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Activity size={16} className="text-indigo-400" />
            <span>Telemetry & Logs</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-mono">
            SSE
          </span>
        </button>

        {/* 3. Settings */}
        <button
          onClick={() => setActiveNav('settings')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
            activeNav === 'settings'
              ? 'bg-gh-subtle text-gh-text-bright border border-gh-blue-border'
              : 'text-gh-text hover:bg-gh-subtle hover:text-gh-text-bright'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Settings size={16} className="text-gh-text-muted" />
            <span>Settings</span>
          </div>
          <span className="text-[11px] text-gh-text-dim font-mono">Model 1</span>
        </button>
      </div>

      {/* Incident Sub-navigation & List */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Incident Filter Pills */}
        <div className="px-3 pt-3 pb-2 flex items-center justify-between border-b border-gh-border/60">
          <div className="flex items-center gap-1 text-[11px]">
            <button
              onClick={() => setIncidentFilter && setIncidentFilter('all')}
              className={`px-2 py-0.5 rounded ${
                incidentFilter === 'all'
                  ? 'bg-gh-border text-gh-text-bright font-semibold'
                  : 'text-gh-text-dim hover:text-gh-text'
              }`}
            >
              All ({incidents.length})
            </button>
            <button
              onClick={() => setIncidentFilter && setIncidentFilter('active')}
              className={`px-2 py-0.5 rounded ${
                incidentFilter === 'active'
                  ? 'bg-amber-950/60 text-amber-300 font-semibold border border-amber-800/40'
                  : 'text-gh-text-dim hover:text-amber-400'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setIncidentFilter && setIncidentFilter('resolved')}
              className={`px-2 py-0.5 rounded ${
                incidentFilter === 'resolved'
                  ? 'bg-emerald-950/60 text-emerald-300 font-semibold border border-emerald-800/40'
                  : 'text-gh-text-dim hover:text-emerald-400'
              }`}
            >
              Resolved ({resolvedCount})
            </button>
          </div>
        </div>

        {/* Scrollable Incident Feed */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredIncidents.length === 0 ? (
            <div className="py-8 px-4 text-center text-gh-text-dim text-xs">
              No {incidentFilter !== 'all' ? incidentFilter : ''} incidents found.
            </div>
          ) : (
            filteredIncidents.map((incident) => {
              const isSelected = activeIncident?.id === incident.id;
              const isAwaiting = incident.status === 'AWAITING_APPROVAL';
              const isResolved =
                incident.status === 'RESOLVED' ||
                incident.status === 'DEPLOYED' ||
                incident.status === 'ROLLED_BACK';

              return (
                <button
                  key={incident.id}
                  onClick={() => {
                    onSelectIncident(incident);
                    setActiveNav('incidents');
                  }}
                  className={`w-full text-left p-2.5 rounded-lg transition-all border ${
                    isSelected
                      ? 'bg-gh-subtle text-gh-text-bright border-indigo-500/50 shadow-sm'
                      : 'text-gh-text border-transparent hover:bg-gh-subtle hover:border-gh-border'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <span className="font-mono text-[11px] font-semibold text-indigo-400 truncate">
                      {incident.id}
                    </span>
                    {isAwaiting && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800 font-semibold animate-pulse">
                        AWAITING
                      </span>
                    )}
                    {isResolved && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                        RESTORED
                      </span>
                    )}
                    {!isAwaiting && !isResolved && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800">
                        {incident.status}
                      </span>
                    )}
                  </div>

                  <div className="text-[12px] font-medium text-gh-text-bright truncate">
                    {incident.suspected_area || incident.title || incident.service}
                  </div>

                  {incident.suspect_commit && (
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gh-text-dim">
                      <GitBranch size={11} className="text-purple-400 flex-shrink-0" />
                      <span className="truncate font-mono">
                        {typeof incident.suspect_commit === 'string'
                          ? incident.suspect_commit.slice(0, 7)
                          : incident.suspect_commit.hash?.slice(0, 7) || 'fix-commit'}
                      </span>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Connected Repo & Render Server Footer */}
      <div className="p-3 border-t border-gh-border bg-gh-subtle/50 text-xs space-y-1.5">
        <div className="flex items-center justify-between text-gh-text-dim">
          <span className="font-mono text-[11px]">Target Service</span>
          <span className="text-gh-text-bright font-mono text-[11px]">demo-prod:8000</span>
        </div>
        <div className="flex items-center justify-between text-gh-text-dim">
          <span className="font-mono text-[11px]">Backend Tunnel</span>
          <span className="text-indigo-400 font-mono text-[10px] truncate max-w-[130px]" title={apiBaseUrl}>
            {apiBaseUrl}
          </span>
        </div>
      </div>
    </aside>
  );
}
