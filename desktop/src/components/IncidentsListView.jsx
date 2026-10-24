import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Search,
  Filter,
  Server,
  GitCommit,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  GitPullRequest,
  Check,
  Radio,
  UserX,
  Flame,
  ArrowRight
} from 'lucide-react';
import {
  formatIncidentId,
  formatStatusLabel,
  getStatusBadgeStyle,
  formatRelativeTime,
  isIncidentActive,
  isIncidentInactive
} from '../utils/formatters';

export default function IncidentsListView({
  incidents = [],
  onSelectIncident,
  onRefresh,
  isRefreshing = false,
  onNavigate
}) {
  const [filter, setFilter] = useState('all'); // all | active | awaiting | resolved
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // newest | severity

  // Telemetry counts
  const counts = useMemo(() => {
    const active = incidents.filter((i) => isIncidentActive(i.status));
    const awaiting = incidents.filter(
      (i) => i.status === 'AWAITING_APPROVAL' || i.status === 'awaiting_approval'
    );
    const resolved = incidents.filter((i) => isIncidentInactive(i.status));
    return {
      total: incidents.length,
      active: active.length,
      awaiting: awaiting.length,
      resolved: resolved.length
    };
  }, [incidents]);

  // Filtered and sorted incidents
  const filteredIncidents = useMemo(() => {
    return incidents
      .filter((inc) => {
        // Status filter
        if (filter === 'active') {
          return isIncidentActive(inc.status);
        }
        if (filter === 'awaiting') {
          return inc.status === 'AWAITING_APPROVAL' || inc.status === 'awaiting_approval';
        }
        if (filter === 'resolved') {
          return isIncidentInactive(inc.status);
        }
        return true;
      })
      .filter((inc) => {
        // Search query
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const idMatch = (inc.id || '').toLowerCase().includes(q);
        const serviceMatch = (inc.service || '').toLowerCase().includes(q);
        const titleMatch = (inc.title || '').toLowerCase().includes(q);
        const causeMatch = (
          inc.brief?.summary ||
          inc.root_cause_report ||
          inc.trace ||
          ''
        ).toLowerCase().includes(q);
        const commitMatch = (inc.suspect_commit || '').toLowerCase().includes(q);
        return idMatch || serviceMatch || titleMatch || causeMatch || commitMatch;
      })
      .sort((a, b) => {
        if (sortBy === 'severity') {
          const sevScore = (s) => {
            const v = (s?.severity || '').toLowerCase();
            if (v.includes('sev1') || v.includes('critical')) return 3;
            if (v.includes('sev2') || v.includes('high')) return 2;
            return 1;
          };
          return sevScore(b) - sevScore(a);
        }
        // Default newest first
        const tA = new Date(a.detected_at || a.created_at || 0).getTime();
        const tB = new Date(b.detected_at || b.created_at || 0).getTime();
        return tB - tA;
      });
  }, [incidents, filter, searchQuery, sortBy]);

  // Extract primary active Sev-1 for top spotlight (if any)
  const activeSev1 = useMemo(() => {
    return incidents.find(
      (i) =>
        isIncidentActive(i.status) &&
        (i.severity?.toLowerCase().includes('sev1') ||
          i.severity?.toLowerCase().includes('critical') ||
          i.status === 'AWAITING_APPROVAL')
    );
  }, [incidents]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-y-auto font-sans">
      {/* Top Header & Telemetry Bar */}
      <div className="sticky top-0 z-30 bg-[#0d111a]/95 backdrop-blur-md border-b border-[#1b2234] px-6 py-4 shrink-0">
        <div className="max-w-[1680px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <ShieldAlert size={20} className="text-[#58a6ff]" />
              <h1 className="text-base font-bold text-[#f0f6fc] tracking-tight">
                Incident Directory
              </h1>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#161f30] text-[#79c0ff] border border-[#263550]">
                {counts.total} Recorded
              </span>
            </div>
            <p className="text-xs text-[#8b949e] mt-1">
              Monitored services and automated remediation fleet status
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#07090f] border border-[#1b2234] text-xs font-mono">
              <span
                className={`w-2 h-2 rounded-full ${
                  counts.active > 0 ? 'bg-[#f85149] animate-pulse' : 'bg-[#3fb950]'
                }`}
              />
              <span className="text-[#8b949e]">Active:</span>
              <span
                className={`font-bold ${
                  counts.active > 0 ? 'text-[#ff7b72]' : 'text-[#f0f6fc]'
                }`}
              >
                {counts.active}
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#07090f] border border-[#1b2234] text-xs font-mono">
              <span
                className={`w-2 h-2 rounded-full ${
                  counts.awaiting > 0 ? 'bg-[#e3b341] animate-pulse' : 'bg-[#6e7681]'
                }`}
              />
              <span className="text-[#8b949e]">Awaiting Sign-off:</span>
              <span
                className={`font-bold ${
                  counts.awaiting > 0 ? 'text-[#e3b341]' : 'text-[#f0f6fc]'
                }`}
              >
                {counts.awaiting}
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#07090f] border border-[#1b2234] text-xs font-mono">
              <CheckCircle2 size={12} className="text-[#3fb950]" />
              <span className="text-[#8b949e]">Resolved:</span>
              <span className="font-bold text-[#3fb950]">{counts.resolved}</span>
            </div>

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-1.5 rounded-md bg-[#161f30] hover:bg-[#1f2c45] text-[#8b949e] hover:text-[#f0f6fc] border border-[#263550] transition disabled:opacity-50 cursor-pointer"
                title="Refresh incident list"
              >
                <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-[#58a6ff]' : ''} />
              </button>
            )}
          </div>
        </div>

        {/* Filters & Search Row */}
        <div className="max-w-[1680px] mx-auto mt-4 pt-3 border-t border-[#1b2234] flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto select-none">
            {[
              { id: 'all', label: 'All Incidents', count: counts.total },
              { id: 'active', label: 'Active', count: counts.active, alert: counts.active > 0 },
              {
                id: 'awaiting',
                label: 'Awaiting Approval',
                count: counts.awaiting,
                warning: counts.awaiting > 0
              },
              { id: 'resolved', label: 'Resolved', count: counts.resolved }
            ].map((tab) => {
              const isActive = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition whitespace-nowrap border cursor-pointer ${
                    isActive
                      ? 'bg-[#161f30] text-[#f0f6fc] border-[#2b3a58] font-semibold'
                      : 'text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#121824] border-transparent'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                      isActive
                        ? 'bg-[#212c42] text-[#79c0ff]'
                        : tab.alert
                        ? 'bg-[#261317] text-[#ff7b72] border border-[#4a1c24]'
                        : tab.warning
                        ? 'bg-[#271d0e] text-[#e3b341] border border-[#4d3814]'
                        : 'bg-[#141b2b] text-[#8b949e]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Sort */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6e7681]"
              />
              <input
                type="text"
                placeholder="Search service, ID, error..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded-md text-xs text-[#f0f6fc] placeholder-[#6e7681] focus:outline-none focus:border-[#58a6ff] transition font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#6e7681] hover:text-[#c9d1d9] font-mono cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#07090f] border border-[#1b2234] rounded-md px-2.5 py-1.5 text-xs text-[#8b949e] focus:outline-none focus:border-[#58a6ff]"
            >
              <option value="newest">Newest First</option>
              <option value="severity">Highest Severity</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full max-w-[1680px] mx-auto px-6 py-6 space-y-6">
        {/* Active Sev-1 Highlight Banner (if in active filter or all) */}
        {activeSev1 && (filter === 'all' || filter === 'active' || filter === 'awaiting') && !searchQuery && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-[#1f1218] via-[#161524] to-[#0e1626] border border-[#5c242c] shadow-lg relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f85149] animate-ping" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#2b1216] text-[#ff7b72] border border-[#541f26]">
                    Active Priority Incident
                  </span>
                  <span className="text-xs font-mono text-[#58a6ff] bg-[#161f30] px-2 py-0.5 rounded border border-[#263550] font-bold">
                    {formatIncidentId(activeSev1.id)}
                  </span>
                  <span className="text-xs font-mono text-[#8b949e]">
                    Service: <span className="text-[#f0f6fc] font-semibold">{activeSev1.service || 'production'}</span>
                  </span>
                </div>
                <h2 className="text-sm md:text-base font-bold text-[#f0f6fc]">
                  {activeSev1.title || 'Outage in Production Service'}
                </h2>
                <p className="text-xs text-[#c9d1d9] max-w-3xl line-clamp-2">
                  {activeSev1.brief?.summary ||
                    activeSev1.root_cause_report ||
                    'Automated analysis and candidate remediation verification currently in progress.'}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right hidden sm:block">
                  <div className="text-[11px] text-[#8b949e] font-mono">Current Status</div>
                  <div className="text-xs font-bold text-[#e3b341] font-mono">
                    {formatStatusLabel(activeSev1.status)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectIncident(activeSev1)}
                  className="px-4 py-2 rounded-lg text-xs font-bold font-mono bg-[#f85149] hover:bg-[#da3633] text-white shadow-md flex items-center gap-2 transition cursor-pointer"
                >
                  <span>Open War Room</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredIncidents.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-[#0d111a] border border-[#1b2234] space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#0d1e17] border border-[#1b3d2b] flex items-center justify-center mx-auto text-[#3fb950]">
              <ShieldCheck size={24} />
            </div>
            <h3 className="text-sm font-bold text-[#f0f6fc]">No Incidents Found</h3>
            <p className="text-xs text-[#8b949e] max-w-md mx-auto">
              {searchQuery
                ? `No incident records match "${searchQuery}". Clear your search or change the status filter.`
                : filter === 'active'
                ? 'No active incidents currently reported. All monitored services are operating normally.'
                : 'No incident history available matching the selected criteria.'}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs font-mono text-[#58a6ff] hover:underline pt-2 cursor-pointer"
              >
                Clear Search Filter
              </button>
            )}
          </div>
        ) : (
          /* Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredIncidents.map((inc) => {
              const isActive = isIncidentActive(inc.status);
              const isAwaiting = inc.status === 'AWAITING_APPROVAL' || inc.status === 'awaiting_approval';
              const isResolved = isIncidentInactive(inc.status);

              const issueNum = inc.github_issue_number || inc.issue_number;
              const prNum = inc.github_pr_number || inc.pr_number;

              return (
                <div
                  key={inc.id}
                  onClick={() => onSelectIncident(inc)}
                  className={`group rounded-xl bg-[#0d111a] border p-4.5 space-y-3.5 transition-all duration-200 hover:shadow-xl cursor-pointer flex flex-col justify-between ${
                    isAwaiting
                      ? 'border-[#5c3e1b] hover:border-[#e3b341]/60 bg-gradient-to-b from-[#12141c] to-[#0d111a]'
                      : isActive
                      ? 'border-[#3d1c24] hover:border-[#ff7b72]/60'
                      : 'border-[#1b2234] hover:border-[#2b3a58]'
                  }`}
                >
                  {/* Top Metadata Header */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isAwaiting
                              ? 'bg-[#e3b341] animate-pulse'
                              : isActive
                              ? 'bg-[#f85149] animate-pulse'
                              : 'bg-[#3fb950]'
                          }`}
                        />
                        <span className="font-mono text-xs font-bold text-[#58a6ff] px-1.5 py-0.5 rounded bg-[#161f30] border border-[#263550]">
                          {formatIncidentId(inc.id)}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide uppercase bg-[#261317] text-[#ff7b72] border border-[#4a1c24]">
                          {inc.severity || 'SEV-1'}
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border font-mono ${getStatusBadgeStyle(
                          inc.status
                        )}`}
                      >
                        {formatStatusLabel(inc.status)}
                      </span>
                    </div>

                    {/* Service Name & Title */}
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-[#8b949e] font-mono mb-1">
                        <Server size={12} className="text-[#58a6ff]" />
                        <span className="text-[#c9d1d9] font-medium truncate">
                          {inc.service || 'production-service'}
                        </span>
                        <span>•</span>
                        <Clock size={11} className="text-[#6e7681]" />
                        <span className="text-[#8b949e]">
                          {formatRelativeTime(inc.detected_at || inc.created_at)}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-[#f0f6fc] group-hover:text-[#58a6ff] transition line-clamp-1">
                        {inc.title || 'Outage in Production Service'}
                      </h3>
                    </div>

                    {/* Brief Root Cause Synopsis */}
                    <div className="p-2.5 rounded-lg bg-[#07090f] border border-[#1b2234] text-xs font-mono text-[#8b949e] leading-relaxed line-clamp-2">
                      {inc.brief?.summary ||
                        inc.root_cause_report ||
                        inc.trace?.slice(0, 140) ||
                        'Telemetry received. Autonomous failure analysis underway.'}
                    </div>

                    {/* Git Commit & Linked Items */}
                    <div className="flex items-center gap-2 flex-wrap pt-0.5 text-[11px] font-mono text-[#8b949e]">
                      {inc.suspect_commit && (
                        <div className="flex items-center gap-1 bg-[#141b2b] px-1.5 py-0.5 rounded border border-[#1b2234] text-[#c9d1d9]">
                          <GitCommit size={11} className="text-[#58a6ff]" />
                          <span className="truncate max-w-[120px]">{inc.suspect_commit}</span>
                        </div>
                      )}
                      {issueNum && (
                        <span className="flex items-center gap-1 bg-[#161f30] px-1.5 py-0.5 rounded border border-[#263550] text-[#79c0ff]">
                          <AlertTriangle size={10} className="text-[#e3b341]" />
                          <span>Issue #{issueNum}</span>
                        </span>
                      )}
                      {prNum && (
                        <span className="flex items-center gap-1 bg-[#0d1e17] px-1.5 py-0.5 rounded border border-[#1b3d2b] text-[#3fb950]">
                          <GitPullRequest size={10} className="text-[#3fb950]" />
                          <span>PR #{prNum}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="pt-3 border-t border-[#1b2234] flex items-center justify-between gap-2 mt-2">
                    <span className="text-[11px] font-mono text-[#6e7681]">
                      {isResolved
                        ? 'Remediation completed'
                        : isAwaiting
                        ? 'Awaiting engineer sign-off'
                        : 'Analysis & remediation active'}
                    </span>

                    <div className="flex items-center gap-1 text-xs font-mono font-medium text-[#58a6ff] group-hover:translate-x-0.5 transition-transform">
                      <span>{isAwaiting ? 'Review & Approve' : 'Open Workbench'}</span>
                      <ArrowRight size={13} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
