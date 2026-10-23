import React from 'react';
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  FolderGit2,
  Clock,
  User,
  ShieldAlert,
  FileCode,
  ArrowUpRight
} from 'lucide-react';

export default function RepositoriesView() {
  const commits = [
    {
      hash: 'a1b2c3d',
      author: 'Vishnu Nandan',
      time: '15m ago',
      message: 'feat: add discount support to order checkout',
      isSuspect: true,
      branch: 'main',
      blame: 'app.py:45',
      impact: 'KeyError: discount'
    },
    {
      hash: 'c9e8a1f',
      author: 'Vishnu Nandan',
      time: '2 hours ago',
      message: 'refactor: extract order tax calculation to separate utility',
      isSuspect: false,
      branch: 'main',
      blame: 'tax.py:12',
      impact: null
    },
    {
      hash: 'f4d3b2e',
      author: 'Devfolio Bot',
      time: '5 hours ago',
      message: 'chore: update production requirements.txt for FastAPI 0.110',
      isSuspect: false,
      branch: 'main',
      blame: 'requirements.txt',
      impact: null
    },
    {
      hash: '88a1b2c',
      author: 'Vishnu Nandan',
      time: '1 day ago',
      message: 'feat: implement initial checkout flow with SQLite storage',
      isSuspect: false,
      branch: 'main',
      blame: 'app.py:1',
      impact: null
    }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-y-auto font-sans">
      {/* Matte SRE Header */}
      <div className="border-b border-[#1b2234] bg-[#0d111a] px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#171f30] border border-[#293652] flex items-center justify-center text-[#58a6ff]">
              <FolderGit2 size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-[#f0f6fc] tracking-tight">
                  Repository & Code Intelligence
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#171f30] text-[#58a6ff] border border-[#293652]">
                  SYNCED
                </span>
              </div>
              <p className="text-[11px] text-[#8b949e] font-mono">
                Git blame correlation, worktree sandboxes & automated PR lifecycle
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://github.com/vishnunandan555/prodpilot"
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded bg-[#171f30] hover:bg-[#1f293d] text-xs font-mono text-[#c9d1d9] border border-[#293652] transition flex items-center gap-1.5"
            >
              <GitBranch size={13} className="text-[#58a6ff]" />
              <span>vishnunandan555/prodpilot</span>
              <ExternalLink size={11} className="text-[#6e7681]" />
            </a>
          </div>
        </div>
      </div>

      <div className="p-5 max-w-5xl w-full mx-auto space-y-4">
        {/* Active Automated PR Panel - Matte SRE Card */}
        <div className="rounded-lg bg-[#0d111a] border border-[#1b2234] border-l-4 border-l-[#58a6ff] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#121929] text-[#58a6ff] border border-[#1d2d47]">
                AUTOMATED REMEDIATION PR #12
              </span>
              <span className="text-[11px] font-mono text-[#8b949e]">
                branch: <code className="text-[#f0f6fc]">prodpilot-fix-inc-20261023-001</code>
              </span>
            </div>
            <span className="text-[11px] font-mono text-[#3fb950] bg-[#0d1e17] border border-[#1b3d2b] px-2 py-0.5 rounded flex items-center gap-1.5">
              <CheckCircle2 size={12} />
              <span>Canary 8001 Verified</span>
            </span>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-[#f0f6fc] font-mono">
              fix: safely access discount key with .get('discount', 0.0) in calculate_order
            </h3>
            <p className="text-[11px] text-[#8b949e] font-mono mt-1">
              Target: <code className="text-[#c9d1d9]">main</code> (commit: <code className="text-[#58a6ff]">c15fdd1</code>) • Scope: <code className="text-[#c9d1d9]">backend/demo_server/app.py:45</code>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-[#1b2234] text-[11px] font-mono">
            <div className="p-2 rounded bg-[#07090f] border border-[#1b2234]">
              <span className="text-[#6e7681] block text-[10px] uppercase">Agent Author</span>
              <span className="text-[#f0f6fc] font-medium block mt-0.5">Google Antigravity (`agy` v1.4.6)</span>
            </div>
            <div className="p-2 rounded bg-[#07090f] border border-[#1b2234]">
              <span className="text-[#6e7681] block text-[10px] uppercase">Reproduction Test</span>
              <span className="text-[#3fb950] font-medium block mt-0.5">test_repro.py PASSED (Exit 0)</span>
            </div>
            <div className="p-2 rounded bg-[#07090f] border border-[#1b2234]">
              <span className="text-[#6e7681] block text-[10px] uppercase">Execution Sandbox</span>
              <span className="text-[#c9d1d9] font-medium block mt-0.5">git worktree .prodpilot_worktree</span>
            </div>
          </div>
        </div>

        {/* Commit History with Blame Correlation Table */}
        <div className="rounded-lg bg-[#0d111a] border border-[#1b2234] p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1b2234] pb-2.5">
            <div className="flex items-center gap-2">
              <GitCommit size={14} className="text-[#58a6ff]" />
              <h2 className="text-xs font-semibold text-[#f0f6fc] font-mono uppercase tracking-wider">
                Production Git Blame Timeline
              </h2>
            </div>
            <span className="text-[10px] font-mono text-[#6e7681]">Tracking upstream / main</span>
          </div>

          <div className="space-y-2">
            {commits.map((c) => (
              <div
                key={c.hash}
                className={`p-3 rounded border font-mono transition ${
                  c.isSuspect
                    ? 'bg-[#160d10] border-[#da3633]'
                    : 'bg-[#07090f] border-[#1b2234] hover:border-[#293652]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold ${c.isSuspect ? 'text-[#ff7b72]' : 'text-[#58a6ff]'}`}>
                        {c.hash}
                      </span>
                      {c.isSuspect && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#261317] text-[#ff7b72] border border-[#4a1c24] flex items-center gap-1">
                          <AlertTriangle size={10} />
                          <span>BLAMED IN OUTAGE</span>
                        </span>
                      )}
                      <span className="text-xs text-[#8b949e] flex items-center gap-1">
                        <User size={11} className="text-[#6e7681]" />
                        {c.author}
                      </span>
                      <span className="text-xs text-[#6e7681]">
                        ({c.time})
                      </span>
                    </div>
                    <p className={`text-xs ${c.isSuspect ? 'text-[#f0f6fc] font-semibold' : 'text-[#c9d1d9]'}`}>
                      {c.message}
                    </p>
                    {c.impact && (
                      <p className="text-[11px] text-[#ff7b72]">
                        Root cause vector: <code className="text-[#ff7b72]">{c.impact}</code>
                      </p>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-[11px] bg-[#171f30] px-2 py-0.5 rounded text-[#c9d1d9] border border-[#293652] flex items-center gap-1">
                      <FileCode size={11} className="text-[#58a6ff]" />
                      <span>{c.blame}</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
