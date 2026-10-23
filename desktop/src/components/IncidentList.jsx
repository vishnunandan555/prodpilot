import React from 'react';
import {
  AlertTriangle,
  GitCommit,
  CheckCircle2,
  Clock,
  ChevronRight,
  Filter,
  Search,
  RotateCcw,
  Sparkles
} from 'lucide-react';

export default function IncidentList({
  incidents,
  selectedId,
  onSelect,
  statusFilter,
  onFilterChange,
  searchQuery,
  onSearchChange
}) {
  const getStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
      case 'CRASHED':
        return <span className="badge badge-open">🚨 OPEN</span>;
      case 'INVESTIGATING':
      case 'FIXING':
        return <span className="badge badge-investigating">⚙️ {status}</span>;
      case 'AWAITING_APPROVAL':
        return <span className="badge badge-awaiting animate-pulse">⏳ AWAITING APPROVAL</span>;
      case 'DEPLOYED':
        return <span className="badge badge-deployed">✅ DEPLOYED</span>;
      case 'ROLLED_BACK':
        return <span className="badge badge-rollback">⏪ ROLLED BACK</span>;
      default:
        return <span className="badge bg-slate-800 text-slate-300">{status}</span>;
    }
  };

  const filteredIncidents = incidents.filter((inc) => {
    const matchesFilter =
      statusFilter === 'ALL' ||
      (statusFilter === 'AWAITING' && inc.status === 'AWAITING_APPROVAL') ||
      (statusFilter === 'OPEN' && (inc.status === 'OPEN' || inc.status === 'INVESTIGATING' || inc.status === 'FIXING')) ||
      (statusFilter === 'RESOLVED' && (inc.status === 'DEPLOYED' || inc.status === 'ROLLED_BACK'));

    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      inc.id?.toLowerCase().includes(query) ||
      inc.service?.toLowerCase().includes(query) ||
      inc.suspected_area?.toLowerCase().includes(query) ||
      inc.suspect_commit?.message?.toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  return (
    <aside className="w-80 md:w-96 flex flex-col border-r border-white/10 bg-[#090e1a]/80 backdrop-blur-md h-[calc(100vh-65px)]">
      {/* Search and Filters Header */}
      <div className="p-4 border-b border-white/10 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search incidents, commits, paths..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
          />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {['ALL', 'AWAITING', 'OPEN', 'RESOLVED'].map((filter) => (
            <button
              key={filter}
              onClick={() => onFilterChange(filter)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                statusFilter === filter
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                  : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Incident List items */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/5">
        {filteredIncidents.length === 0 ? (
          <div className="p-8 text-center text-slate-500 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-slate-400">No matching incidents</p>
            <p className="text-xs">Trigger a crash using the header button to simulate an incident.</p>
          </div>
        ) : (
          filteredIncidents.map((incident) => {
            const isSelected = selectedId === incident.id;
            const suspect = incident.suspect_commit || {};
            const timeAgo = suspect.minutes_ago !== undefined ? `${suspect.minutes_ago}m ago` : '';

            return (
              <div
                key={incident.id}
                onClick={() => onSelect(incident.id)}
                className={`p-4 cursor-pointer transition-all border-l-2 ${
                  isSelected
                    ? 'bg-indigo-500/10 border-indigo-500 text-white shadow-inner'
                    : 'border-transparent hover:bg-white/[0.03] text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-mono text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    {incident.id}
                  </span>
                  {getStatusBadge(incident.status)}
                </div>

                <div className="text-sm font-semibold text-slate-100 flex items-center justify-between">
                  <span>{incident.service}</span>
                  {incident.suspected_area && (
                    <span className="text-[11px] font-mono text-indigo-400 bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-500/20">
                      {incident.suspected_area}
                    </span>
                  )}
                </div>

                {/* Suspect commit summary */}
                {suspect.hash && (
                  <div className="mt-2 text-xs text-slate-400 bg-black/30 p-2 rounded-lg border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-amber-300/90 flex items-center gap-1">
                        <GitCommit className="w-3 h-3 text-amber-400" />
                        {suspect.hash}
                      </span>
                      <span className="text-[11px] text-slate-500">{timeAgo}</span>
                    </div>
                    <p className="text-slate-300 text-xs truncate">
                      {suspect.message || 'feat: update checkout calculation'}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
