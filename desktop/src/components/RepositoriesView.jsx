import React, { useState, useEffect } from 'react';
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
  ArrowUpRight,
  Plus,
  Trash2,
  Check,
  Folder,
  RefreshCw,
  Terminal,
  Server
} from 'lucide-react';

export default function RepositoriesView({ apiUrl = 'http://127.0.0.1:8765', activeIncident = null }) {
  const [repos, setRepos] = useState([]);
  const [activeRepo, setActiveRepo] = useState(null);
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);

  // Form states
  const [repoName, setRepoName] = useState('chunkstream');
  const [localPath, setLocalPath] = useState('/home/vishnunandan555/Projects/chunkstream');
  const [testCmd, setTestCmd] = useState('pytest');
  const [healthUrl, setHealthUrl] = useState('http://127.0.0.1:8000/health');
  const [port, setPort] = useState(8000);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState(null);
  const [connectSuccess, setConnectSuccess] = useState(null);

  const fetchRepos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/repos`);
      if (res.ok) {
        const data = await res.json();
        setRepos(data.repos || []);
        setActiveRepo(data.active_repo || null);
      }
    } catch (err) {
      console.warn('Failed to fetch repos:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCommits = async () => {
    setCommitsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/repos/active/commits`);
      if (res.ok) {
        const data = await res.json();
        setCommits(data.commits || []);
      }
    } catch (err) {
      console.warn('Failed to fetch active commits:', err);
    } finally {
      setCommitsLoading(false);
    }
  };

  useEffect(() => {
    fetchRepos();
    fetchCommits();
  }, [apiUrl]);

  const handleConnectRepo = async (e) => {
    e.preventDefault();
    setConnectLoading(true);
    setConnectError(null);
    setConnectSuccess(null);

    try {
      const res = await fetch(`${apiUrl}/repos/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: repoName.trim(),
          local_path: localPath.trim(),
          test_cmd: testCmd.trim(),
          health_url: healthUrl.trim(),
          port: Number(port),
          set_active: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to connect repository');
      }

      setConnectSuccess(`Repository '${repoName}' connected (Branch: ${data.git?.branch || 'main'}, Commit: ${data.git?.commit || 'HEAD'})`);
      setTimeout(() => {
        setShowConnectModal(false);
        setConnectSuccess(null);
        fetchRepos();
        fetchCommits();
      }, 1000);
    } catch (err) {
      setConnectError(err.message || 'Failed to connect repository');
    } finally {
      setConnectLoading(false);
    }
  };

  const handleActivateRepo = async (repoId) => {
    try {
      await fetch(`${apiUrl}/repos/${repoId}/activate`, { method: 'POST' });
      fetchRepos();
      fetchCommits();
    } catch (err) {
      console.error('Failed to activate repo:', err);
    }
  };

  const handleDeleteRepo = async (repoId) => {
    try {
      await fetch(`${apiUrl}/repos/${repoId}`, { method: 'DELETE' });
      fetchRepos();
      fetchCommits();
    } catch (err) {
      console.error('Failed to delete repo:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-y-auto font-sans">
      {/* Header */}
      <div className="border-b border-[#1b2234] bg-[#0d111a] px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#171f30] border border-[#293652] flex items-center justify-center text-[#58a6ff]">
              <FolderGit2 size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-[#f0f6fc] tracking-tight">
                  Connected Repositories & Worktrees
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b]">
                  {repos.length} CONNECTED
                </span>
              </div>
              <p className="text-[11px] text-[#8b949e] font-mono">
                Source code correlation, worktree isolation, git blame & test runner configuration
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConnectModal(true)}
              className="px-2.5 py-1 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-mono flex items-center gap-1.5 transition"
            >
              <Plus size={13} />
              <span>Connect Repository</span>
            </button>
            <button
              onClick={() => {
                fetchRepos();
                fetchCommits();
              }}
              className="p-1 rounded bg-[#171f30] hover:bg-[#1f293d] border border-[#293652] text-[#8b949e] hover:text-[#f0f6fc] transition"
              title="Refresh repositories"
            >
              <RefreshCw size={13} className={loading || commitsLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 max-w-5xl w-full mx-auto space-y-4">
        {/* Connected Repositories Grid */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#8b949e]">
              Connected Target Codebases
            </h2>
            <span className="text-[10px] font-mono text-[#6e7681]">Active repo used for agent remediation</span>
          </div>

          {repos.length === 0 ? (
            <div className="p-6 rounded-lg bg-[#0d111a] border border-[#1b2234] text-center space-y-2">
              <FolderGit2 size={24} className="mx-auto text-[#6e7681]" />
              <p className="text-xs font-mono text-[#c9d1d9]">No repository connected yet</p>
              <p className="text-[11px] font-mono text-[#8b949e]">
                Click "Connect Repository" to hook ProdPilot into your local code (e.g. chunkstream)
              </p>
              <button
                onClick={() => setShowConnectModal(true)}
                className="mt-2 px-3 py-1.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-mono inline-flex items-center gap-1.5 transition"
              >
                <Plus size={13} />
                <span>Connect Codebase Now</span>
              </button>
            </div>
          ) : (
            repos.map((r) => {
              const isActive = r.is_active === 1 || activeRepo?.id === r.id;
              return (
                <div
                  key={r.id}
                  className={`p-3.5 rounded-lg bg-[#0d111a] border transition space-y-2 ${
                    isActive
                      ? 'border-[#388bfd] border-l-4 border-l-[#58a6ff]'
                      : 'border-[#1b2234] hover:border-[#293652]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1b2234] pb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded bg-[#171f30] border border-[#293652] flex items-center justify-center text-[#58a6ff]">
                        <GitBranch size={14} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-[#f0f6fc] font-mono">{r.name}</h3>
                          {isActive && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b] font-bold">
                              ACTIVE TARGET
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-[#8b949e] mt-0.5 flex items-center gap-1.5">
                          <span>Path:</span>
                          <code className="text-[#c9d1d9] bg-[#07090f] px-1 py-0.2 rounded border border-[#1b2234]">
                            {r.local_path}
                          </code>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono">
                      {!isActive && (
                        <button
                          onClick={() => handleActivateRepo(r.id)}
                          className="px-2 py-0.5 rounded bg-[#171f30] hover:bg-[#1f293d] border border-[#293652] text-[#58a6ff] text-[11px]"
                        >
                          Set as Active
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteRepo(r.id)}
                        className="p-1 rounded text-[#6e7681] hover:text-[#ff7b72] transition"
                        title="Disconnect repository"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono pt-1 text-[#8b949e]">
                    <div>
                      <span className="text-[#6e7681] block text-[10px]">TEST RUNNER</span>
                      <span className="text-[#c9d1d9]">{r.test_cmd || 'pytest'}</span>
                    </div>
                    <div>
                      <span className="text-[#6e7681] block text-[10px]">HEALTH PROBE</span>
                      <span className="text-[#58a6ff] truncate block">{r.health_url || ':8000/health'}</span>
                    </div>
                    <div>
                      <span className="text-[#6e7681] block text-[10px]">PROD PORT</span>
                      <span className="text-[#c9d1d9]">{r.port || 8000}</span>
                    </div>
                    <div>
                      <span className="text-[#6e7681] block text-[10px]">SANDBOX</span>
                      <span className="text-[#3fb950]">.prodpilot_worktree</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Active Automated PR Panel (Only show if active incident has patch or remediation PR) */}
        {activeIncident && activeIncident.brief?.summary ? (
          <div className="rounded-lg bg-[#0d111a] border border-[#1b2234] border-l-4 border-l-[#58a6ff] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#121929] text-[#58a6ff] border border-[#1d2d47]">
                  ACTIVE REMEDIATION PR
                </span>
                <span className="text-[11px] font-mono text-[#8b949e]">
                  incident: <code className="text-[#f0f6fc]">{activeIncident.id}</code>
                </span>
              </div>
              <span className="text-[11px] font-mono text-[#3fb950] bg-[#0d1e17] border border-[#1b3d2b] px-2 py-0.5 rounded flex items-center gap-1.5">
                <CheckCircle2 size={12} />
                <span>{activeIncident.status}</span>
              </span>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-[#f0f6fc] font-mono">
                {activeIncident.brief.summary}
              </h3>
              <p className="text-[11px] text-[#8b949e] font-mono mt-1">
                Target Repo: <code className="text-[#58a6ff]">{activeRepo?.name || 'Connected Target'}</code> • Worktree Verified
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-[#0d111a] border border-[#1b2234] p-4 flex items-center justify-between text-xs font-mono text-[#6e7681]">
            <div className="flex items-center gap-2">
              <GitPullRequest size={14} className="text-[#6e7681]" />
              <span>No active remediation pull request. Codebase main branch is clean.</span>
            </div>
            <span className="text-[#3fb950]">HEALTHY</span>
          </div>
        )}

        {/* Commit History with Blame Correlation Table */}
        <div className="rounded-lg bg-[#0d111a] border border-[#1b2234] p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1b2234] pb-2.5">
            <div className="flex items-center gap-2">
              <GitCommit size={14} className="text-[#58a6ff]" />
              <h2 className="text-xs font-semibold text-[#f0f6fc] font-mono uppercase tracking-wider">
                Production Git Commit History & Blame Timeline ({commits.length})
              </h2>
            </div>
            <span className="text-[10px] font-mono text-[#6e7681]">
              {activeRepo ? `Target: ${activeRepo.name} (live git log)` : 'No active repo'}
            </span>
          </div>

          <div className="space-y-2">
            {commits.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-[#6e7681]">
                {activeRepo
                  ? 'No git commits found in the active repository.'
                  : 'Connect a repository above to stream live git commits and enable automated git blame.'}
              </div>
            ) : (
              commits.map((c) => (
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
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Connect Repository Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0d111a] border border-[#1b2234] rounded-xl shadow-2xl overflow-hidden font-sans">
            <div className="bg-[#07090f] px-5 py-4 border-b border-[#1b2234] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderGit2 size={16} className="text-[#58a6ff]" />
                <h3 className="text-xs font-bold text-[#f0f6fc] font-mono">Connect Local Code Repository</h3>
              </div>
              <button onClick={() => setShowConnectModal(false)} className="text-[#6e7681] hover:text-[#f0f6fc]">
                ✕
              </button>
            </div>

            <form onSubmit={handleConnectRepo} className="p-5 space-y-3.5">
              {connectError && (
                <div className="p-2.5 rounded bg-[#261317] border border-[#4a1c24] text-[#ff7b72] text-xs font-mono flex items-center gap-2">
                  <AlertTriangle size={14} className="flex-shrink-0" />
                  <span>{connectError}</span>
                </div>
              )}

              {connectSuccess && (
                <div className="p-2.5 rounded bg-[#0d1e17] border border-[#1b3d2b] text-[#3fb950] text-xs font-mono flex items-center gap-2">
                  <CheckCircle2 size={14} className="flex-shrink-0" />
                  <span>{connectSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-mono text-[#8b949e] mb-1">Service / Repo Name</label>
                <input
                  type="text"
                  required
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="chunkstream"
                  className="w-full px-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#8b949e] mb-1">Local Repository Path (Absolute)</label>
                <input
                  type="text"
                  required
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="/home/vishnunandan555/Projects/chunkstream"
                  className="w-full px-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                />
                <span className="text-[10px] font-mono text-[#6e7681] mt-0.5 block">
                  Must be an initialized git repository with committed code.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#8b949e] mb-1">Test Command</label>
                  <input
                    type="text"
                    value={testCmd}
                    onChange={(e) => setTestCmd(e.target.value)}
                    placeholder="pytest"
                    className="w-full px-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-[#8b949e] mb-1">Production Port</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="8000"
                    className="w-full px-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#8b949e] mb-1">Health Probe URL</label>
                <input
                  type="text"
                  value={healthUrl}
                  onChange={(e) => setHealthUrl(e.target.value)}
                  placeholder="http://127.0.0.1:8000/health"
                  className="w-full px-3 py-1.5 bg-[#07090f] border border-[#1b2234] rounded text-xs font-mono text-[#f0f6fc] focus:outline-none focus:border-[#58a6ff]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-3 py-1.5 rounded bg-[#161b26] hover:bg-[#212a3d] border border-[#212a3d] text-xs font-mono text-[#8b949e] hover:text-[#c9d1d9]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectLoading}
                  className="px-4 py-1.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-mono font-medium disabled:opacity-50 flex items-center gap-1.5"
                >
                  {connectLoading ? 'Connecting & Verifying...' : 'Connect & Activate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
