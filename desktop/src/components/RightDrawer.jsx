import React, { useState } from 'react';
import {
  Plus,
  Maximize2,
  Minimize2,
  Terminal,
  Globe,
  Folder,
  MessageSquare,
  TrendingUp,
  Layout,
  FileCode,
  X,
  CheckCircle2
} from 'lucide-react';
import DiffViewer from './DiffViewer';

export default function RightDrawer({
  incident,
  events = [],
  activeTab = 'changes',
  setActiveTab
}) {
  const [showAutoCleanup, setShowAutoCleanup] = useState(true);

  // Derive diff from incident artifacts or events
  const patchDiff = incident?.artifacts?.patch_diff || incident?.diff || '';

  return (
    <aside className="w-[340px] flex-shrink-0 bg-gh-surface border-l border-gh-border flex flex-col h-full select-none">
      {/* Top Header Controls */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-gh-border text-gh-text-muted">
        <button className="p-1 hover:text-gh-text-bright rounded hover:bg-gh-subtle transition-colors" title="New pane">
          <Plus size={15} />
        </button>
        <button className="p-1 hover:text-gh-text-bright rounded hover:bg-gh-subtle transition-colors" title="Expand view">
          <Maximize2 size={13} />
        </button>
      </div>

      {/* Tab Navigation List (Screenshot Match) */}
      <div className="p-2 space-y-0.5 border-b border-gh-border">
        <button
          onClick={() => setActiveTab('changes')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
            activeTab === 'changes'
              ? 'bg-gh-subtle text-gh-text-bright border border-gh-border'
              : 'text-gh-text hover:bg-gh-subtle hover:text-gh-text-bright'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Plus size={14} className="text-gh-text-muted" />
            <span className="font-medium">Changes</span>
          </div>
          <span className="text-[11px] text-gh-text-dim font-mono">Ctrl \</span>
        </button>

        <button
          onClick={() => setActiveTab('terminal')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
            activeTab === 'terminal'
              ? 'bg-gh-subtle text-gh-text-bright border border-gh-border'
              : 'text-gh-text hover:bg-gh-subtle hover:text-gh-text-bright'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Terminal size={14} className="text-gh-text-muted" />
            <span>Terminal</span>
          </div>
          <span className="text-[11px] text-gh-text-dim font-mono">Ctrl `</span>
        </button>

        <button
          onClick={() => setActiveTab('browser')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
            activeTab === 'browser'
              ? 'bg-gh-subtle text-gh-text-bright border border-gh-border'
              : 'text-gh-text hover:bg-gh-subtle hover:text-gh-text-bright'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Globe size={14} className="text-gh-text-muted" />
            <span>Browser</span>
          </div>
          {incident?.staged_ports && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
              :8001
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('files')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
            activeTab === 'files'
              ? 'bg-gh-subtle text-gh-text-bright border border-gh-border'
              : 'text-gh-text hover:bg-gh-subtle hover:text-gh-text-bright'
          }`}
        >
          <Folder size={14} className="text-gh-text-muted" />
          <span>Files</span>
        </button>

        <button
          onClick={() => setActiveTab('side_chat')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
            activeTab === 'side_chat'
              ? 'bg-gh-subtle text-gh-text-bright border border-gh-border'
              : 'text-gh-text hover:bg-gh-subtle hover:text-gh-text-bright'
          }`}
        >
          <MessageSquare size={14} className="text-gh-text-muted" />
          <span>Side chat</span>
        </button>

        <button
          onClick={() => setActiveTab('insights')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
            activeTab === 'insights'
              ? 'bg-gh-subtle text-gh-text-bright border border-gh-border'
              : 'text-gh-text hover:bg-gh-subtle hover:text-gh-text-bright'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <TrendingUp size={14} className="text-gh-text-muted" />
            <span>Insights</span>
          </div>
          {incident?.decision && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-950 text-blue-400 font-mono">
              {Math.round((incident.decision.confidence || 0.85) * 100)}%
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('canvas')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
            activeTab === 'canvas'
              ? 'bg-gh-subtle text-gh-text-bright border border-gh-border'
              : 'text-gh-text hover:bg-gh-subtle hover:text-gh-text-bright'
          }`}
        >
          <Layout size={14} className="text-gh-text-muted" />
          <span>Canvas</span>
        </button>
      </div>

      {/* Tab Active Content Area */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'changes' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[12px] text-gh-text-muted pb-2 border-b border-gh-border">
              <span>Changed Files (1)</span>
              <span className="text-emerald-400 font-mono">+3 -1</span>
            </div>
            {patchDiff ? (
              <DiffViewer diff={patchDiff} />
            ) : (
              <div className="p-4 text-center text-gh-text-dim text-[12px] bg-gh-canvas border border-gh-border rounded">
                No active git diff.
              </div>
            )}
          </div>
        )}

        {activeTab === 'terminal' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[12px] text-gh-text-muted pb-2 border-b border-gh-border">
              <span>Runner Output</span>
              <span className="text-[10px] text-emerald-400 font-mono">Live</span>
            </div>
            <div className="bg-gh-inset border border-gh-border rounded p-2.5 font-mono text-[11px] text-gh-text space-y-1 overflow-x-auto max-h-[300px]">
              {events.length > 0 ? (
                events.map((ev, idx) => (
                  <div key={idx} className="leading-relaxed">
                    <span className="text-gh-text-dim">[{new Date(ev.timestamp || Date.now()).toLocaleTimeString()}]</span>{' '}
                    <span className="text-emerald-400 font-semibold">{ev.stage}</span>{' '}
                    <span className="text-gh-text-muted">{ev.kind}:</span>{' '}
                    <span>{typeof ev.payload === 'string' ? ev.payload : JSON.stringify(ev.payload)}</span>
                  </div>
                ))
              ) : (
                <div className="text-gh-text-dim">No recent terminal events.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'browser' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[12px] text-gh-text-muted pb-2 border-b border-gh-border">
              <span>Canary Preview (Port 8001)</span>
              <a
                href="http://127.0.0.1:8001/health"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-gh-blue-text hover:underline"
              >
                Open in tab
              </a>
            </div>
            <div className="border border-gh-border rounded overflow-hidden bg-gh-inset p-3 text-center space-y-2">
              <div className="text-[12px] text-gh-text-muted">Target Service:</div>
              <div className="font-mono text-emerald-400 text-[13px]">http://127.0.0.1:8001</div>
              <div className="text-[11px] text-gh-text-dim">
                Fix-forward canary running with generated reproduction test verification.
              </div>
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-3">
            <div className="text-[12px] font-semibold text-gh-text-bright pb-2 border-b border-gh-border">
              Autonomous Decision Reasoning
            </div>
            {incident?.decision ? (
              <div className="space-y-2 text-[12px]">
                <div className="bg-gh-subtle p-2.5 rounded border border-gh-border">
                  <div className="text-gh-text-muted text-[11px]">Recommended Action</div>
                  <div className="text-gh-text-bright font-bold uppercase mt-0.5">
                    {incident.decision.action}
                  </div>
                  <div className="text-gh-text-dim text-[11px] mt-1">
                    {incident.decision.reason}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gh-text-dim text-[12px] p-2">
                Awaiting decision engine recommendation.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Auto-Cleanup Card (Exact Screenshot Match) */}
      {showAutoCleanup && (
        <div className="m-3 p-3 bg-gh-subtle border border-gh-border rounded-lg relative text-[12px] space-y-2">
          <button
            onClick={() => setShowAutoCleanup(false)}
            className="absolute top-2 right-2 text-gh-text-dim hover:text-gh-text transition-colors"
          >
            <X size={13} />
          </button>
          <div className="font-semibold text-gh-text-bright">Free up space from finished work?</div>
          <p className="text-gh-text-muted text-[11px] leading-relaxed">
            Auto-cleanup archives sessions from merged pull requests to free disk space. Sessions are archived 15 days after inactivity and can be restored. Archived sessions are deleted after 30 days.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button className="gh-btn-secondary px-2.5 py-1 text-[11px]">
              Turn on auto-cleanup
            </button>
            <button className="text-gh-text-muted hover:text-gh-text-bright text-[11px] px-2 py-1">
              Go to settings
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
