import React from 'react';
import {
  Plus,
  GitPullRequest,
  CircleDot,
  Calendar,
  Layers,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Search,
  PanelLeftClose,
  Folder,
  GitBranch,
  SlidersHorizontal,
  MessageSquare,
  Settings,
  Flame
} from 'lucide-react';

export default function Sidebar({
  activeNav,
  setActiveNav,
  incidents = [],
  activeIncident,
  onSelectIncident,
  issues = [],
  activeIssue,
  onSelectIssue
}) {
  return (
    <aside className="w-[260px] flex-shrink-0 bg-gh-surface border-r border-gh-border flex flex-col h-full select-none">
      {/* Top Window Navigation Controls */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-gh-border text-gh-text-muted">
        <button className="p-1 hover:text-gh-text-bright rounded hover:bg-gh-subtle transition-colors" title="Toggle Sidebar">
          <PanelLeftClose size={15} />
        </button>
        <div className="flex items-center gap-1">
          <button className="p-1 hover:text-gh-text-bright rounded hover:bg-gh-subtle transition-colors" title="Search">
            <Search size={14} />
          </button>
          <button className="p-1 hover:text-gh-text-bright rounded hover:bg-gh-subtle transition-colors" title="Back">
            <ChevronLeft size={14} />
          </button>
          <button className="p-1 hover:text-gh-text-bright rounded hover:bg-gh-subtle transition-colors" title="Forward">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Main Navigation Links */}
      <div className="p-2 space-y-0.5 border-b border-gh-border">
        <button
          onClick={() => setActiveNav('new_session')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
            activeNav === 'new_session'
              ? 'bg-gh-subtle text-gh-text-bright border border-gh-blue-border'
              : 'text-gh-text hover:bg-gh-subtle hover:text-gh-text-bright'
          }`}
        >
          <Plus size={15} className="text-gh-text-muted" />
          <span>New</span>
        </button>

        <button
          onClick={() => setActiveNav('pull_requests')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
            activeNav === 'pull_requests'
              ? 'bg-gh-subtle text-gh-text-bright border border-gh-blue-border'
              : 'text-gh-text hover:bg-gh-subtle hover:text-gh-text-bright'
          }`}
        >
          <GitPullRequest size={15} className="text-gh-text-muted" />
          <span>Pull requests</span>
        </button>

        <button
          onClick={() => setActiveNav('issues')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
            activeNav === 'issues'
              ? 'bg-gh-subtle text-gh-text-bright border border-gh-blue-border'
              : 'text-gh-text hover:bg-gh-subtle hover:text-gh-text-bright'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <CircleDot size={15} className="text-gh-text-muted" />
            <span>Issues</span>
          </div>
          {issues.length > 0 && (
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-gh-border text-gh-text-muted font-mono">
              {issues.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveNav('automations')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
            activeNav === 'automations'
              ? 'bg-gh-subtle text-gh-text-bright border border-gh-blue-border'
              : 'text-gh-text hover:bg-gh-subtle hover:text-gh-text-bright'
          }`}
        >
          <Calendar size={15} className="text-gh-text-muted" />
          <span>Automations</span>
        </button>

        <button
          onClick={() => setActiveNav('customize')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
            activeNav === 'customize'
              ? 'bg-gh-subtle text-gh-text-bright border border-gh-blue-border'
              : 'text-gh-text hover:bg-gh-subtle hover:text-gh-text-bright'
          }`}
        >
          <Layers size={15} className="text-gh-text-muted" />
          <span>Customize</span>
        </button>

        {/* ProdPilot Supercharge Nav Item */}
        <button
          onClick={() => setActiveNav('incidents')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
            activeNav === 'incidents'
              ? 'bg-gh-subtle text-gh-text-bright border border-gh-blue-border'
              : 'text-gh-text hover:bg-gh-subtle hover:text-gh-text-bright'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <ShieldAlert size={15} className={incidents.some(i => i.status !== 'RESOLVED' && i.status !== 'DEPLOYED') ? 'text-amber-400' : 'text-gh-text-muted'} />
            <span>Incidents</span>
          </div>
          {incidents.filter(i => i.status !== 'RESOLVED' && i.status !== 'DEPLOYED').length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800 font-mono font-semibold">
              {incidents.filter(i => i.status !== 'RESOLVED' && i.status !== 'DEPLOYED').length} active
            </span>
          )}
        </button>
      </div>

      {/* Sessions Section (Repository Tree) */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="flex items-center justify-between px-2 mb-2 text-gh-text-muted">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Sessions</span>
          <div className="flex items-center gap-1">
            <button className="p-0.5 hover:text-gh-text-bright rounded" title="Filter sessions">
              <SlidersHorizontal size={12} />
            </button>
            <button
              onClick={() => setActiveNav('new_session')}
              className="p-0.5 hover:text-gh-text-bright rounded"
              title="Add session"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>

        {/* Repository Folder: demo-prod */}
        <div className="space-y-1 mb-3">
          <div className="flex items-center gap-1.5 px-2 py-1 text-[12px] text-gh-text-muted font-medium">
            <Folder size={13} />
            <span>demo-prod</span>
          </div>

          <div className="pl-4 space-y-0.5">
            {incidents.map((incident) => {
              const isSelected = activeIncident?.id === incident.id && (activeNav === 'session' || activeNav === 'incidents');
              return (
                <div key={incident.id} className="space-y-0.5">
                  <button
                    onClick={() => {
                      onSelectIncident(incident);
                      setActiveNav('session');
                    }}
                    className={`w-full text-left px-2 py-1 rounded text-[12px] truncate transition-colors flex items-center justify-between ${
                      isSelected
                        ? 'bg-gh-subtle text-gh-text-bright border border-gh-border'
                        : 'text-gh-text hover:bg-gh-subtle hover:text-gh-text-bright'
                    }`}
                    title={incident.suspected_area || incident.title}
                  >
                    <span className="truncate">
                      {incident.status !== 'RESOLVED' ? `🚨 #${incident.id} ${incident.suspected_area || 'Crash'}` : `✅ #${incident.id} Resolved`}
                    </span>
                    {incident.status === 'AWAITING_APPROVAL' && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 animate-pulse ml-1" />
                    )}
                  </button>

                  {/* Sub-branch item */}
                  <div className="pl-3 flex items-center gap-1.5 py-0.5 text-[11px] text-gh-text-dim">
                    <GitBranch size={11} className="text-gh-purple-text flex-shrink-0" />
                    <span className="truncate">fix: {incident.suspect_commit ? incident.suspect_commit.substring(0, 7) : 'hotfix'}</span>
                  </div>
                </div>
              );
            })}

            {/* Default active sample session if no incident */}
            {incidents.length === 0 && (
              <div>
                <button
                  onClick={() => setActiveNav('session')}
                  className="w-full text-left px-2 py-1 rounded text-[12px] text-gh-text-bright bg-gh-subtle truncate"
                >
                  [FEATURE] Fix KeyError discount #1
                </button>
                <div className="pl-3 flex items-center gap-1.5 py-0.5 text-[11px] text-gh-text-dim">
                  <GitBranch size={11} className="text-gh-purple-text flex-shrink-0" />
                  <span className="truncate">fix: replace discount access</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Repository Folder: care_app */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 px-2 py-1 text-[12px] text-gh-text-muted font-medium">
            <Folder size={13} />
            <span>care_app</span>
          </div>
          <div className="pl-4 space-y-0.5">
            <div className="px-2 py-1 text-[12px] text-gh-text-muted truncate">
              Set up Playwright browser testing
            </div>
            <div className="pl-3 flex items-center gap-1.5 py-0.5 text-[11px] text-gh-text-dim">
              <GitBranch size={11} className="text-gh-purple-text flex-shrink-0" />
              <span className="truncate">feat: e2e test suite</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom User Profile Bar (Screenshot Match) */}
      <div className="h-12 px-3 border-t border-gh-border flex items-center justify-between text-gh-text">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-6 h-6 rounded-full bg-gh-subtle border border-gh-border flex items-center justify-center text-[10px] font-semibold text-gh-text-bright flex-shrink-0">
            VN
          </div>
          <span className="text-[12px] font-medium text-gh-text-bright truncate">Vishnu Nandan</span>
        </div>
        <div className="flex items-center gap-1 text-gh-text-muted">
          <button className="p-1 hover:text-gh-text-bright rounded hover:bg-gh-subtle transition-colors" title="Feedback">
            <MessageSquare size={14} />
          </button>
          <button className="p-1 hover:text-gh-text-bright rounded hover:bg-gh-subtle transition-colors" title="Settings">
            <Settings size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
