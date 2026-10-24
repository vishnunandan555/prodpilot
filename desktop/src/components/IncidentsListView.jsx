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
  ArrowRight,
  LayoutGrid,
  List,
  Terminal,
  ExternalLink,
  Cpu,
  Layers
} from 'lucide-react';
import {
  formatIncidentId,
  formatStatusLabel,
  getStatusBadgeStyle,
  formatRelativeTime,
  isIncidentActive,
  isIncidentInactive
} from '../utils/formatters';

// 7-Stage Incident Resolution Lifecycle stages
const LIFECYCLE_STAGES = [
  { key: 'DETECT', label: 'Detect', minStatus: ['OPEN', 'DETECTED', 'INVESTIGATING'] },
  { key: 'DIAGNOSE', label: 'Diagnose', minStatus: ['INVESTIGATING', 'ANALYZING', 'FIXING'] },
  { key: 'REPRO', label: 'Repro', minStatus: ['FIXING', 'REPRODUCING'] },
  { key: 'FIX', label: 'Fix', minStatus: ['FIXING', 'CANARY_TESTING', 'AWAITING_APPROVAL'] },
  { key: 'CANARY', label: 'Canary', minStatus: ['CANARY_TESTING', 'AWAITING_APPROVAL'] },
  { key: 'APPROVE', label: 'Approve', minStatus: ['AWAITING_APPROVAL', 'APPROVED', 'DEPLOYING'] },
  { key: 'DEPLOY', label: 'Deploy', minStatus: ['DEPLOYED', 'RESOLVED', 'CLOSED'] }
];

function getLifecycleProgress(status) {
  const s = (status || '').toUpperCase();
  if (s === 'MANUAL_TAKEOVER') return { currentIdx: 7, label: 'Manual Takeover (Operator Control)', percent: 100 };
  if (s === 'DEPLOYED' || s === 'RESOLVED' || s === 'CLOSED') return { currentIdx: 7, label: 'Stage 7/7: Production Restored', percent: 100 };
  if (s === 'AWAITING_APPROVAL') return { currentIdx: 5, label: 'Stage 6/7: Approval Gate (Standby)', percent: 85 };
  if (s === 'CANARY_TESTING') return { currentIdx: 4, label: 'Stage 5/7: Canary Verification (:8001/:8002)', percent: 70 };
  if (s === 'FIXING') return { currentIdx: 3, label: 'Stage 4/7: Patch Synthesis & Repro Proof', percent: 55 };
  if (s === 'INVESTIGATING' || s === 'ANALYZING') return { currentIdx: 1, label: 'Stage 2/7: Root Cause Analysis', percent: 30 };
  return { currentIdx: 0, label: 'Stage 1/7: Autonomous Triage', percent: 15 };
}

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
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  // Telemetry counts
  const counts = useMemo(() => {
    const active = incidents.filter((i) => isIncidentActive(i.status));
    const awaiting = incidents.filter(
      (i) => i.status === 'AWAITING_APPROVAL' || i.status === 'awaiting_approval'
    );
    const resolved = incidents.filter((i) => isIncidentInactive(i.status));
    const uniqueServices = new Set(incidents.map((i) => i.service).filter(Boolean));
    return {
      total: incidents.length,
      active: active.length,
      awaiting: awaiting.length,
      resolved: resolved.length,
      servicesCount: uniqueServices.size || 1
    };
  }, [incidents]);

  // Filtered and sorted incidents
  const filteredIncidents = useMemo(() => {
    return incidents
      .filter((inc) => {
        if (filter === 'active') return isIncidentActive(inc.status);
        if (filter === 'awaiting') return inc.status === 'AWAITING_APPROVAL' || inc.status === 'awaiting_approval';
        if (filter === 'resolved') return isIncidentInactive(inc.status);
        return true;
      })
      .filter((inc) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const idMatch = (inc.id || '').toLowerCase().includes(q);
        const serviceMatch = (inc.service || '').toLowerCase().includes(q);
        const titleMatch = (inc.title || '').toLowerCase().includes(q);
        const causeMatch = (
          inc.summary ||
          inc.brief?.summary ||
          inc.root_cause_report ||
          inc.suspected_area ||
          ''
        ).toLowerCase().includes(q);
        const commitMatch = (
          typeof inc.suspect_commit === 'string'
            ? inc.suspect_commit
            : inc.suspect_commit?.hash || ''
        ).toLowerCase().includes(q);
        return idMatch || serviceMatch || titleMatch || causeMatch || commitMatch;
      })
      .sort((a, b) => {
        if (sortBy === 'severity') {
          const score = (s) => {
            const v = (s?.severity || '').toLowerCase();
            if (v.includes('sev-1') || v.includes('critical')) return 3;
            if (v.includes('sev-2') || v.includes('high')) return 2;
            return 1;
          };
          return score(b) - score(a);
        }
        const tA = new Date(a.detected_at || a.created_at || 0).getTime();
        const tB = new Date(b.detected_at || b.created_at || 0).getTime();
        return tB - tA;
      });
  }, [incidents, filter, searchQuery, sortBy]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-y-auto font-sans select-text">
      {/* Executive Fleet Command Header */}
      <div className="sticky top-0 z-30 bg-[#0d111a]/95 backdrop-blur-md border-b border-[#1b2234] px-6 py-4 shrink-0 shadow-sm">
        <div className="max-w-[1680px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#161f30] border border-[#263550] flex items-center justify-center text-[#58a6ff]">
                <ShieldAlert size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base font-bold text-[#f0f6fc] tracking-tight">
                    Incident Directory
                  </h1>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#161f30] text-[#79c0ff] border border-[#263550] font-semibold">
                    {counts.total} Incidents
                  </span>
                  {counts.active > 0 ? (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#261317] text-[#ff7b72] border border-[#4a1c24] flex items-center gap-1.5 font-bold animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#f85149]" />
                      <span>{counts.active} Service Outage Active</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b] flex items-center gap-1.5 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />
                      <span>Fleet Nominal • No Active Outages</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#8b949e] mt-0.5">
                  Autonomous remediation fleet oversight, diagnosis logs, and production gate sign-offs
                </p>
              </div>
            </div>
          </div>

          {/* Telemetry Stat Cards */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[#07090f] border border-[#1b2234]">
              <Server size={14} className="text-[#58a6ff]" />
              <div className="text-left font-mono">
                <div className="text-[10px] text-[#8b949e] uppercase">Monitored Services</div>
                <div className="text-xs font-bold text-[#f0f6fc]">{counts.servicesCount} Active</div>
              </div>
            </div>

            <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[#07090f] border border-[#1b2234]">
              <Activity size={14} className={counts.active > 0 ? 'text-[#ff7b72]' : 'text-[#3fb950]'} />
              <div className="text-left font-mono">
                <div className="text-[10px] text-[#8b949e] uppercase">Active Outages</div>
                <div className={`text-xs font-bold ${counts.active > 0 ? 'text-[#ff7b72]' : 'text-[#3fb950]'}`}>
                  {counts.active}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[#07090f] border border-[#1b2234]">
              <CheckCircle2 size={14} className="text-[#3fb950]" />
              <div className="text-left font-mono">
                <div className="text-[10px] text-[#8b949e] uppercase">Resolved Rate</div>
                <div className="text-xs font-bold text-[#3fb950]">100% Auto</div>
              </div>
            </div>

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-2 rounded-lg bg-[#161f30] hover:bg-[#1f2c45] text-[#8b949e] hover:text-[#f0f6fc] border border-[#263550] transition disabled:opacity-50 cursor-pointer"
                title="Refresh incident list"
              >
                <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-[#58a6ff]' : ''} />
              </button>
            )}
          </div>
        </div>

        {/* Filters, Search & View Switcher */}
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
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
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

          {/* Search, Sort, View Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 sm:w-72">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6e7681]"
              />
              <input
                type="text"
                placeholder="Search error, file, service, ID..."
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

            {/* View Mode Toggle: Cards vs Dense Table */}
            <div className="flex items-center bg-[#07090f] border border-[#1b2234] rounded-md p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded text-xs transition cursor-pointer flex items-center gap-1 ${
                  viewMode === 'cards'
                    ? 'bg-[#161f30] text-[#58a6ff] font-semibold shadow-sm'
                    : 'text-[#8b949e] hover:text-[#c9d1d9]'
                }`}
                title="Command Cards Grid"
              >
                <LayoutGrid size={13} />
                <span className="hidden sm:inline text-[11px] font-mono">Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded text-xs transition cursor-pointer flex items-center gap-1 ${
                  viewMode === 'table'
                    ? 'bg-[#161f30] text-[#58a6ff] font-semibold shadow-sm'
                    : 'text-[#8b949e] hover:text-[#c9d1d9]'
                }`}
                title="Dense Fleet Table"
              >
                <List size={13} />
                <span className="hidden sm:inline text-[11px] font-mono">Table</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full max-w-[1680px] mx-auto px-6 py-6 space-y-6">
        {filteredIncidents.length === 0 ? (
          <div className="p-16 text-center rounded-2xl bg-[#0d111a] border border-[#1b2234] space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-[#0d1e17] border border-[#1b3d2b] flex items-center justify-center mx-auto text-[#3fb950]">
              <ShieldCheck size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#f0f6fc]">No Incidents Found</h3>
              <p className="text-xs text-[#8b949e] max-w-md mx-auto leading-relaxed">
                {searchQuery
                  ? `No incident matches "${searchQuery}". Reset filters to see all fleet records.`
                  : filter === 'active'
                  ? 'All services are nominal. No active incidents are undergoing autonomous remediation.'
                  : 'No incident history recorded matching the current filter.'}
              </p>
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs font-mono px-3 py-1.5 rounded-md bg-[#161f30] text-[#58a6ff] hover:bg-[#1f2c45] border border-[#263550] transition cursor-pointer inline-flex items-center gap-1"
              >
                Clear Search Query
              </button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          /* ================= DENSE FLEET TABLE VIEW ================= */
          <div className="rounded-xl border border-[#1b2234] overflow-hidden bg-[#0d111a] shadow-lg">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#07090f] border-b border-[#1b2234] text-[#8b949e] text-[10px] uppercase font-mono tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">Incident</th>
                  <th className="px-3 py-3 font-semibold">Severity</th>
                  <th className="px-3 py-3 font-semibold">Service</th>
                  <th className="px-4 py-3 font-semibold">Root Cause Synopsis</th>
                  <th className="px-3 py-3 font-semibold">Lifecycle Progress</th>
                  <th className="px-3 py-3 font-semibold">Attribution</th>
                  <th className="px-3 py-3 font-semibold">Detected</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141b2b]">
                {filteredIncidents.map((inc) => {
                  const isActive = isIncidentActive(inc.status);
                  const isAwaiting = inc.status === 'AWAITING_APPROVAL' || inc.status === 'awaiting_approval';
                  const isResolved = isIncidentInactive(inc.status);
                  const progress = getLifecycleProgress(inc.status);
                  const suspectCommit = typeof inc.suspect_commit === 'string'
                    ? inc.suspect_commit
                    : inc.suspect_commit?.hash;

                  return (
                    <tr
                      key={inc.id}
                      onClick={() => onSelectIncident(inc)}
                      className="hover:bg-[#121826]/75 transition cursor-pointer group"
                    >
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isAwaiting
                                ? 'bg-[#e3b341] animate-pulse'
                                : isActive
                                ? 'bg-[#f85149] animate-pulse'
                                : 'bg-[#3fb950]'
                            }`}
                          />
                          <span className="font-mono text-xs font-bold text-[#58a6ff] px-2 py-0.5 rounded bg-[#161f30] border border-[#263550]">
                            {formatIncidentId(inc.id)}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide uppercase bg-[#261317] text-[#ff7b72] border border-[#4a1c24]">
                          {inc.severity || 'SEV-1'}
                        </span>
                      </td>

                      <td className="px-3 py-3.5 whitespace-nowrap font-mono">
                        <div className="flex items-center gap-1.5 text-[#c9d1d9] font-medium">
                          <Server size={12} className="text-[#58a6ff] shrink-0" />
                          <span>{inc.service || 'service'}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 max-w-md">
                        <div className="space-y-0.5">
                          <div className="text-xs font-semibold text-[#f0f6fc] group-hover:text-[#58a6ff] transition truncate">
                            {inc.title || 'Outage in Production Service'}
                          </div>
                          <div className="text-[11px] font-mono text-[#8b949e] truncate">
                            {inc.summary || inc.root_cause_report || 'Analysis in progress...'}
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3.5 whitespace-nowrap font-mono">
                        <div className="space-y-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusBadgeStyle(inc.status)}`}>
                            {formatStatusLabel(inc.status)}
                          </span>
                          <div className="text-[10px] text-[#6e7681]">
                            {progress.label}
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3.5 whitespace-nowrap font-mono text-[11px] text-[#8b949e]">
                        {inc.suspected_area ? (
                          <span className="truncate max-w-[130px] block text-[#a5d6ff]">
                            {inc.suspected_area.split('/').pop()}
                          </span>
                        ) : suspectCommit ? (
                          <span className="text-[#c9d1d9]">{suspectCommit.slice(0, 7)}</span>
                        ) : (
                          <span className="text-[#6e7681]">--</span>
                        )}
                      </td>

                      <td className="px-3 py-3.5 whitespace-nowrap font-mono text-[11px] text-[#8b949e]">
                        {formatRelativeTime(inc.detected_at || inc.created_at)}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1 text-xs font-mono font-medium text-[#58a6ff] group-hover:translate-x-1 transition-transform">
                          <span>{isAwaiting ? 'Sign-Off' : 'Workbench'}</span>
                          <ArrowRight size={13} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ================= COMMAND CARDS GRID VIEW ================= */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredIncidents.map((inc) => {
              const isActive = isIncidentActive(inc.status);
              const isAwaiting = inc.status === 'AWAITING_APPROVAL' || inc.status === 'awaiting_approval';
              const isResolved = isIncidentInactive(inc.status);
              const isTakeover = inc.status === 'MANUAL_TAKEOVER';
              const progress = getLifecycleProgress(inc.status);

              const suspectCommit = typeof inc.suspect_commit === 'string'
                ? inc.suspect_commit
                : inc.suspect_commit?.hash;
              const suspectFile = inc.suspected_area || inc.brief?.suspect_file;

              const issueNum = inc.github_issue_number || inc.issue_number;
              const prNum = inc.github_pr_number || inc.pr_number;

              // Border accents
              const accentColor = isTakeover
                ? 'border-l-[#a371f7]'
                : isAwaiting
                ? 'border-l-[#e3b341]'
                : isActive
                ? 'border-l-[#f85149]'
                : 'border-l-[#3fb950]';

              return (
                <div
                  key={inc.id}
                  onClick={() => onSelectIncident(inc)}
                  className={`group rounded-xl bg-[#0d111a] border border-[#1b2234] border-l-[5px] ${accentColor} p-5 space-y-4 transition-all duration-200 hover:border-r-[#388bfd]/60 hover:border-t-[#388bfd]/60 hover:border-b-[#388bfd]/60 hover:shadow-2xl cursor-pointer flex flex-col justify-between`}
                >
                  <div className="space-y-3.5">
                    {/* Top Row: Service, Port, Status & Sev Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isAwaiting
                              ? 'bg-[#e3b341] animate-pulse'
                              : isActive
                              ? 'bg-[#f85149] animate-pulse'
                              : 'bg-[#3fb950]'
                          }`}
                        />
                        <span className="font-mono text-xs font-bold text-[#58a6ff] px-2 py-0.5 rounded bg-[#161f30] border border-[#263550]">
                          {formatIncidentId(inc.id)}
                        </span>
                        <div className="flex items-center gap-1 font-mono text-xs text-[#c9d1d9] bg-[#07090f] px-2 py-0.5 rounded border border-[#1b2234]">
                          <Server size={11} className="text-[#58a6ff]" />
                          <span className="font-medium truncate">{inc.service || 'production'}</span>
                          <span className="text-[#6e7681]">:8000</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide uppercase bg-[#261317] text-[#ff7b72] border border-[#4a1c24]">
                          {inc.severity || 'SEV-1'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border font-mono ${getStatusBadgeStyle(
                            inc.status
                          )}`}
                        >
                          {formatStatusLabel(inc.status)}
                        </span>
                      </div>
                    </div>

                    {/* Incident Title */}
                    <div>
                      <h2 className="text-sm md:text-base font-bold text-[#f0f6fc] group-hover:text-[#58a6ff] transition leading-snug line-clamp-1">
                        {inc.title || 'Outage in Production Service'}
                      </h2>
                    </div>

                    {/* Root Cause & Diagnosis Terminal Box */}
                    <div className="rounded-lg bg-[#07090f] border border-[#1b2234] p-3 space-y-1.5 font-mono">
                      <div className="flex items-center justify-between text-[10px] text-[#8b949e] border-b border-[#141b2b] pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Terminal size={11} className="text-[#58a6ff]" />
                          <span>DIAGNOSTIC EVIDENCE</span>
                        </div>
                        {suspectFile && (
                          <span className="text-[#a5d6ff] truncate max-w-[200px]">
                            {suspectFile.split('/').slice(-2).join('/')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#c9d1d9] leading-relaxed line-clamp-2">
                        {inc.summary || inc.root_cause_report || 'Autonomous diagnostic analysis in progress.'}
                      </p>
                    </div>

                    {/* 7-Stage Lifecycle Progress Track */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-[#8b949e]">
                        <span className="flex items-center gap-1 text-[#c9d1d9]">
                          <Activity size={10} className="text-[#58a6ff]" />
                          <span>{progress.label}</span>
                        </span>
                        <span>{progress.percent}%</span>
                      </div>

                      {/* Mini 7-stage bar segments */}
                      <div className="grid grid-cols-7 gap-1 h-1.5">
                        {LIFECYCLE_STAGES.map((stg, sIdx) => {
                          const isDone = sIdx < progress.currentIdx;
                          const isCurrent = sIdx === progress.currentIdx;
                          return (
                            <div
                              key={stg.key}
                              className={`rounded-full transition-all ${
                                isDone
                                  ? 'bg-[#3fb950]'
                                  : isCurrent
                                  ? isAwaiting
                                    ? 'bg-[#e3b341] animate-pulse'
                                    : 'bg-[#58a6ff] animate-pulse'
                                  : 'bg-[#1b2234]'
                              }`}
                              title={stg.label}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Attribution & Linked Badges */}
                    <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px] font-mono text-[#8b949e]">
                      {suspectCommit && (
                        <div className="flex items-center gap-1 bg-[#141b2b] px-2 py-0.5 rounded border border-[#1b2234] text-[#c9d1d9]">
                          <GitCommit size={11} className="text-[#58a6ff]" />
                          <span className="truncate max-w-[120px]">{suspectCommit}</span>
                        </div>
                      )}
                      {issueNum && (
                        <span className="flex items-center gap-1 bg-[#161f30] px-2 py-0.5 rounded border border-[#263550] text-[#79c0ff]">
                          <AlertTriangle size={10} className="text-[#e3b341]" />
                          <span>Issue #{issueNum}</span>
                        </span>
                      )}
                      {prNum && (
                        <span className="flex items-center gap-1 bg-[#0d1e17] px-2 py-0.5 rounded border border-[#1b3d2b] text-[#3fb950]">
                          <GitPullRequest size={10} className="text-[#3fb950]" />
                          <span>PR #{prNum}</span>
                        </span>
                      )}
                      <div className="flex items-center gap-1 ml-auto text-[10px] text-[#6e7681]">
                        <Clock size={11} />
                        <span>{formatRelativeTime(inc.detected_at || inc.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="pt-3.5 border-t border-[#1b2234] flex items-center justify-between gap-3 mt-3">
                    <span className="text-[11px] font-mono text-[#8b949e]">
                      {isResolved
                        ? 'Production Nominal (200 OK)'
                        : isAwaiting
                        ? 'Standby for Operator Review'
                        : isTakeover
                        ? 'Operator Manual Override'
                        : 'Autonomous Remediation Active'}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectIncident(inc);
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer ${
                        isAwaiting
                          ? 'bg-[#e3b341] hover:bg-[#d29922] text-[#07090f]'
                          : 'bg-[#161f30] hover:bg-[#1f2c45] text-[#58a6ff] hover:text-[#fff] border border-[#263550]'
                      }`}
                    >
                      <span>{isAwaiting ? 'Review & Approve' : 'Open Workbench'}</span>
                      <ArrowRight size={13} />
                    </button>
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
