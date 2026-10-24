import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  Plus,
  RefreshCw,
  ExternalLink,
  GitBranch,
  AlertCircle,
  GitPullRequest,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Trash2,
  Star,
  Folder,
  ShieldAlert,
  Search,
  MessageSquare
} from 'lucide-react';
import { ListItemSkeleton } from './LoadingSkeleton';

export default function ProjectsView({ apiUrl }) {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [activeTab, setActiveTab] = useState('issues'); // 'issues', 'prs', 'deploys', 'commits'

  // Sub-data states
  const [issues, setIssues] = useState([]);
  const [prs, setPrs] = useState([]);
  const [deploys, setDeploys] = useState([]);
  const [commits, setCommits] = useState([]);

  // Filter & loading states
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [issueFilter, setIssueFilter] = useState('open'); // 'open', 'closed', 'all'
  const [prFilter, setPrFilter] = useState('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [projectProgress, setProjectProgress] = useState(null);

  // Add Project Form
  const [form, setForm] = useState({
    name: '',
    github_repo: '',
    github_token: '',
    local_path: '',
    default_branch: 'main',
    test_cmd: 'pytest'
  });

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/projects`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        setActiveProject(data.active_project || null);

        // If no project selected yet, default to active project or first project
        if (!selectedProjectId && data.projects?.length > 0) {
          const initial = data.active_project || data.projects[0];
          setSelectedProjectId(initial.id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [apiUrl]);

  const currentProject = projects.find((p) => p.id === selectedProjectId) || activeProject;

  // Fetch project sub-resources when selected project or sub-tab changes
  const fetchSubData = async () => {
    if (!currentProject?.id) return;
    setDataLoading(true);
    setErrorMsg('');

    try {
      if (activeTab === 'issues') {
        const res = await fetch(`${apiUrl}/projects/${currentProject.id}/issues?state=${issueFilter}`);
        if (res.ok) {
          const data = await res.json();
          setIssues(data.issues || []);
          if (!data.ok && data.error) setErrorMsg(data.error);
        }
      } else if (activeTab === 'prs') {
        const res = await fetch(`${apiUrl}/projects/${currentProject.id}/prs?state=${prFilter}`);
        if (res.ok) {
          const data = await res.json();
          setPrs(data.pull_requests || []);
          if (!data.ok && data.error) setErrorMsg(data.error);
        }
      } else if (activeTab === 'deploys') {
        const res = await fetch(`${apiUrl}/projects/${currentProject.id}/deploys`);
        if (res.ok) {
          const data = await res.json();
          setDeploys(data.runs || []);
          if (!data.ok && data.error) setErrorMsg(data.error);
        }
      } else if (activeTab === 'commits') {
        const res = await fetch(`${apiUrl}/projects/${currentProject.id}/commits`);
        if (res.ok) {
          const data = await res.json();
          setCommits(data.commits || []);
          if (!data.ok && data.error) setErrorMsg(data.error);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to fetch project data');
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    fetchSubData();
  }, [selectedProjectId, activeTab, issueFilter, prFilter]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!form.name || !form.github_repo) {
      alert('Please fill out Project Name and GitHub Repo.');
      return;
    }

    setSubmitting(true);
    setProjectProgress({
      step: 1,
      total_steps: 4,
      stage: 'validating',
      title: 'Validating GitHub Repository',
      detail: `Connecting to GitHub API for ${form.github_repo}...`,
      logs: [
        `Target Name: ${form.name}`,
        `Repository: ${form.github_repo}`,
        form.local_path ? `Local path specified: ${form.local_path}` : 'Local path omitted: auto-cloning into managed storage (~/.prodpilot/projects/)'
      ],
      status: 'running'
    });

    try {
      const res = await fetch(`${apiUrl}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to create project');

      const isGhVerified = data.github_status?.ok === true;

      setProjectProgress({
        step: 4,
        total_steps: 4,
        stage: 'completed',
        title: isGhVerified ? 'Project Initialized & Verified!' : 'Project Initialized (GitHub Warning)',
        detail: `Local path: ${data.project?.local_path} • Branch: ${data.project?.default_branch || 'main'} • Test: ${data.project?.test_cmd || 'pytest'}`,
        logs: [
          isGhVerified
            ? `Repository verified on GitHub: ${data.github_status?.repo?.full_name || form.github_repo}`
            : `GitHub Warning: ${data.github_status?.error || 'GitHub PAT missing or repo unverified (local operations available)'}`,
          `Cloned/Initialized at: ${data.project?.local_path}`,
          `Default branch: ${data.project?.default_branch || 'main'}`,
          `Test runner: ${data.project?.test_cmd || 'pytest'}`,
          'Autonomous SRE watchdog and worktree sandbox ready.'
        ],
        status: isGhVerified ? 'success' : 'warning',
        project: data.project
      });

      await fetchProjects();
      if (data.project?.id) {
        setSelectedProjectId(data.project.id);
      }

      setTimeout(() => {
        setShowAddModal(false);
        setProjectProgress(null);
        setForm({
          name: '',
          github_repo: '',
          github_token: '',
          local_path: '',
          default_branch: 'main',
          test_cmd: 'pytest'
        });
      }, 2000);

    } catch (err) {
      setProjectProgress({
        step: 4,
        total_steps: 4,
        stage: 'error',
        title: 'Project Initialization Failed',
        detail: err.message || 'Failed to clone repository or connect project.',
        logs: [`Error: ${err.message}`],
        status: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivateProject = async (id) => {
    try {
      const res = await fetch(`${apiUrl}/projects/${id}/activate`, { method: 'POST' });
      if (res.ok) {
        await fetchProjects();
      }
    } catch (err) {
      alert('Failed to set project active');
    }
  };

  const handleDeleteProject = async (id) => {
    if (!window.confirm('Are you sure you want to remove this project? (Local files will not be deleted)')) return;
    try {
      const res = await fetch(`${apiUrl}/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedProjectId(null);
        await fetchProjects();
      }
    } catch (err) {
      alert('Failed to delete project');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-hidden font-sans">
      {/* Top Header */}
      <div className="h-14 border-b border-[#1b2234] bg-[#0d111a] px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#161f30] border border-[#263550] flex items-center justify-center text-[#58a6ff]">
            <FolderGit2 size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#f0f6fc]">Projects</h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#161f30] text-[#79c0ff] border border-[#263550] font-mono">
                {projects.length} Total
              </span>
            </div>
            <p className="text-[11px] text-[#8b949e]">
              Connected repositories, GitHub live data & local workspaces
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {projects.length > 0 && (
            <select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-[#121824] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-1.5 rounded-md focus:outline-none focus:border-[#58a6ff]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.is_active ? '★ (Active)' : ''} — {p.github_repo}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => {
              fetchProjects();
              fetchSubData();
            }}
            disabled={loading || dataLoading}
            title="Refresh Project Data"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#121824] hover:bg-[#1a2334] text-[#c9d1d9] hover:text-[#f0f6fc] border border-[#222f47] text-xs font-medium transition"
          >
            <RefreshCw size={13} className={loading || dataLoading ? 'animate-spin text-[#58a6ff]' : 'text-[#8b949e]'} />
            <span>Sync / Refresh</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus size={14} />
            <span>Add Project</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading && projects.length === 0 ? (
        <div className="flex-1 p-8 max-w-4xl w-full mx-auto space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 text-xs text-[#58a6ff] pb-2">
            <RefreshCw size={13} className="animate-spin" />
            <span>Connecting to project repositories...</span>
          </div>
          <ListItemSkeleton count={3} />
        </div>
      ) : projects.length === 0 ? (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#121824] border border-[#23314d] flex items-center justify-center text-[#58a6ff] mb-4 shadow-xl">
            <FolderGit2 size={32} />
          </div>
          <h2 className="text-base font-bold text-[#f0f6fc] mb-2">No Connected Projects</h2>
          <p className="text-xs text-[#8b949e] max-w-md mb-6 leading-relaxed">
            ProdPilot monitors real GitHub repositories to ingest live issues, inspect pull requests,
            track GitHub Actions deployment logs, and run local test suites for autonomous RCA.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold shadow-md transition"
          >
            <Plus size={16} />
            <span>Connect Your First Project</span>
          </button>
        </div>
      ) : (
        /* Active Project Details View */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Project Details Banner */}
          {currentProject && (
            <div className="p-5 border-b border-[#1b2234] bg-[#0a0e17] flex-shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-bold text-[#f0f6fc]">{currentProject.name}</h2>
                    {currentProject.is_active ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#14261d] text-[#3fb950] border border-[#1e462d]">
                        <Star size={10} className="fill-[#3fb950]" /> Active Project
                      </span>
                    ) : (
                      <button
                        onClick={() => handleActivateProject(currentProject.id)}
                        className="text-[10px] px-2 py-0.5 rounded bg-[#161f30] hover:bg-[#1d2b45] text-[#79c0ff] border border-[#263550] transition"
                      >
                        Set as Active
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-2 text-xs text-[#8b949e]">
                    <a
                      href={`https://github.com/${currentProject.github_repo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[#58a6ff] hover:underline font-mono"
                    >
                      <span>{currentProject.github_repo}</span>
                      <ExternalLink size={12} />
                    </a>

                    <div className="flex items-center gap-1 font-mono text-[11px] text-[#8b949e]">
                      <GitBranch size={12} className="text-[#a371f7]" />
                      <span>{currentProject.default_branch || 'main'}</span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-[#8b949e]">
                      <Folder size={12} className="text-[#d29922]" />
                      <span className="font-mono">{currentProject.local_path}</span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-[#8b949e]">
                      <Terminal size={12} className="text-[#7ee787]" />
                      <span className="font-mono">{currentProject.test_cmd || 'pytest'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteProject(currentProject.id)}
                    title="Delete Project Connection"
                    className="p-1.5 rounded bg-[#1f1519] border border-[#3e1d25] text-[#ff7b72] hover:bg-[#341b23] transition text-xs flex items-center gap-1"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {/* Sub Navigation Tabs */}
              <div className="flex items-center justify-between mt-5 border-b border-[#1b2234] pb-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('issues')}
                    className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition ${
                      activeTab === 'issues'
                        ? 'border-[#58a6ff] text-[#f0f6fc]'
                        : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9]'
                    }`}
                  >
                    <AlertCircle size={14} className="text-[#ff7b72]" />
                    <span>Active Issues</span>
                    {issues.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#261317] text-[#ff7b72] border border-[#4a1c24] font-mono">
                        {issues.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab('prs')}
                    className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition ${
                      activeTab === 'prs'
                        ? 'border-[#58a6ff] text-[#f0f6fc]'
                        : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9]'
                    }`}
                  >
                    <GitPullRequest size={14} className="text-[#3fb950]" />
                    <span>Pull Requests</span>
                    {prs.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#122419] text-[#3fb950] border border-[#1f4a2b] font-mono">
                        {prs.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab('deploys')}
                    className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition ${
                      activeTab === 'deploys'
                        ? 'border-[#58a6ff] text-[#f0f6fc]'
                        : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9]'
                    }`}
                  >
                    <CheckCircle2 size={14} className="text-[#58a6ff]" />
                    <span>GitHub Actions Logs</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('commits')}
                    className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition ${
                      activeTab === 'commits'
                        ? 'border-[#58a6ff] text-[#f0f6fc]'
                        : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9]'
                    }`}
                  >
                    <GitBranch size={14} className="text-[#a371f7]" />
                    <span>Local Git Commits</span>
                  </button>
                </div>

                <button
                  onClick={fetchSubData}
                  disabled={dataLoading}
                  className="flex items-center gap-1.5 px-3 py-1 mb-1 rounded bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] hover:text-[#a5d6ff] border border-[#273855] text-xs font-medium transition shadow-sm"
                  title="Fetch latest data from GitHub and local repository"
                >
                  <RefreshCw size={12} className={dataLoading ? 'animate-spin text-[#58a6ff]' : ''} />
                  <span>Refresh Tab</span>
                </button>
              </div>
            </div>
          )}

          {/* Sub Tab Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {errorMsg && (
              <div className="p-3 mb-4 rounded-lg bg-[#241316] border border-[#481c25] text-xs text-[#ff7b72] flex items-center gap-2">
                <ShieldAlert size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* --- TAB 1: ISSUES --- */}
            {activeTab === 'issues' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#8b949e]">Filter:</span>
                    {['open', 'closed', 'all'].map((st) => (
                      <button
                        key={st}
                        onClick={() => setIssueFilter(st)}
                        className={`text-[11px] px-2.5 py-1 rounded capitalize transition ${
                          issueFilter === st
                            ? 'bg-[#1f2b40] text-[#79c0ff] border border-[#2d4265]'
                            : 'bg-[#121824] text-[#8b949e] hover:text-[#c9d1d9] border border-transparent'
                        }`}
                      >
                        {st}
                      </button>
                    ))}

                    <button
                      onClick={fetchSubData}
                      disabled={dataLoading}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#273855] text-xs font-medium transition ml-2"
                      title="Refresh issues from GitHub"
                    >
                      <RefreshCw size={11} className={dataLoading ? 'animate-spin text-[#58a6ff]' : ''} />
                      <span>Refresh Issues</span>
                    </button>
                  </div>

                  <span className="text-xs text-[#8b949e] font-mono">
                    Showing {issues.length} {issueFilter} issues from GitHub
                  </span>
                </div>

                {dataLoading && issues.length === 0 ? (
                  <div className="py-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs text-[#58a6ff] pb-1">
                      <RefreshCw size={12} className="animate-spin" />
                      <span>Fetching issues from GitHub...</span>
                    </div>
                    <ListItemSkeleton count={3} />
                  </div>
                ) : issues.length === 0 ? (
                  <div className="p-12 text-center border border-dashed border-[#1b2234] rounded-xl bg-[#0a0e17]">
                    {errorMsg ? (
                      <>
                        <ShieldAlert size={28} className="mx-auto text-[#d29922] mb-2" />
                        <p className="text-xs text-[#f0f6fc] font-semibold">GitHub Issues Unavailable</p>
                        <p className="text-[11px] text-[#ff7b72] mt-1 mb-4">{errorMsg}</p>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={28} className="mx-auto text-[#3fb950] mb-2" />
                        <p className="text-xs text-[#f0f6fc] font-semibold">No issues found</p>
                        <p className="text-[11px] text-[#8b949e] mt-1 mb-4">
                          No issues matching state "{issueFilter}" in {currentProject?.github_repo}.
                        </p>
                      </>
                    )}
                    <button
                      onClick={fetchSubData}
                      disabled={dataLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#273855] text-xs font-medium transition"
                    >
                      <RefreshCw size={12} className={dataLoading ? 'animate-spin' : ''} />
                      <span>Refresh from GitHub</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {issues.map((issue) => (
                      <div
                        key={issue.id || issue.number}
                        className="p-4 rounded-lg bg-[#0e1420] border border-[#1b2438] hover:border-[#2b3a5a] transition flex items-start justify-between gap-4"
                      >
                        <div className="flex items-start gap-3">
                          <AlertCircle
                            size={16}
                            className={issue.state === 'open' ? 'text-[#ff7b72] mt-0.5' : 'text-[#8957e5] mt-0.5'}
                          />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <a
                                href={issue.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-bold text-[#f0f6fc] hover:text-[#58a6ff] hover:underline"
                              >
                                {issue.title}
                              </a>
                              <span className="text-[11px] font-mono text-[#8b949e]">#{issue.number}</span>
                              {issue.labels?.map((lbl) => (
                                <span
                                  key={lbl.id || lbl.name}
                                  className="text-[10px] px-2 py-0.2 rounded-full font-mono border"
                                  style={{
                                    backgroundColor: `#${lbl.color}15`,
                                    borderColor: `#${lbl.color}40`,
                                    color: `#${lbl.color}`
                                  }}
                                >
                                  {lbl.name}
                                </span>
                              ))}
                            </div>

                            <p className="text-[11px] text-[#8b949e] mt-1 line-clamp-2">
                              {issue.body || 'No description provided.'}
                            </p>

                            <div className="flex items-center gap-4 mt-2 text-[10px] text-[#6e7681]">
                              <span>Opened by {issue.user?.login || 'contributor'}</span>
                              <span className="flex items-center gap-1">
                                <Clock size={10} />
                                {new Date(issue.created_at).toLocaleDateString()}
                              </span>
                              {issue.comments > 0 && (
                                <span className="flex items-center gap-1 text-[#8b949e]">
                                  <MessageSquare size={10} />
                                  {issue.comments} comments
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <a
                          href={issue.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#273855] text-[11px] flex items-center gap-1 flex-shrink-0 transition"
                        >
                          <span>View on GitHub</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* --- TAB 2: PULL REQUESTS --- */}
            {activeTab === 'prs' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#8b949e]">Filter:</span>
                    {['open', 'closed', 'all'].map((st) => (
                      <button
                        key={st}
                        onClick={() => setPrFilter(st)}
                        className={`text-[11px] px-2.5 py-1 rounded capitalize transition ${
                          prFilter === st
                            ? 'bg-[#1f2b40] text-[#79c0ff] border border-[#2d4265]'
                            : 'bg-[#121824] text-[#8b949e] hover:text-[#c9d1d9] border border-transparent'
                        }`}
                      >
                        {st}
                      </button>
                    ))}

                    <button
                      onClick={fetchSubData}
                      disabled={dataLoading}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#273855] text-xs font-medium transition ml-2"
                      title="Refresh pull requests from GitHub"
                    >
                      <RefreshCw size={11} className={dataLoading ? 'animate-spin text-[#58a6ff]' : ''} />
                      <span>Refresh Pull Requests</span>
                    </button>
                  </div>

                  <span className="text-xs text-[#8b949e] font-mono">
                    Showing {prs.length} {prFilter} pull requests
                  </span>
                </div>

                {dataLoading && prs.length === 0 ? (
                  <div className="py-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs text-[#58a6ff] pb-1">
                      <RefreshCw size={12} className="animate-spin" />
                      <span>Fetching pull requests from GitHub...</span>
                    </div>
                    <ListItemSkeleton count={3} />
                  </div>
                ) : prs.length === 0 ? (
                  <div className="p-12 text-center border border-dashed border-[#1b2234] rounded-xl bg-[#0a0e17]">
                    {errorMsg ? (
                      <>
                        <ShieldAlert size={28} className="mx-auto text-[#d29922] mb-2" />
                        <p className="text-xs text-[#f0f6fc] font-semibold">GitHub Pull Requests Unavailable</p>
                        <p className="text-[11px] text-[#ff7b72] mt-1 mb-4">{errorMsg}</p>
                      </>
                    ) : (
                      <>
                        <GitPullRequest size={28} className="mx-auto text-[#8b949e] mb-2" />
                        <p className="text-xs text-[#f0f6fc] font-semibold">No pull requests</p>
                        <p className="text-[11px] text-[#8b949e] mt-1 mb-4">No pull requests found with state "{prFilter}".</p>
                      </>
                    )}
                    <button
                      onClick={fetchSubData}
                      disabled={dataLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#273855] text-xs font-medium transition"
                    >
                      <RefreshCw size={12} className={dataLoading ? 'animate-spin' : ''} />
                      <span>Refresh from GitHub</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {prs.map((pr) => (
                      <div
                        key={pr.id || pr.number}
                        className="p-4 rounded-lg bg-[#0e1420] border border-[#1b2438] hover:border-[#2b3a5a] transition flex items-start justify-between gap-4"
                      >
                        <div className="flex items-start gap-3">
                          <GitPullRequest
                            size={16}
                            className={
                              pr.merged_at
                                ? 'text-[#8957e5] mt-0.5'
                                : pr.state === 'open'
                                ? 'text-[#3fb950] mt-0.5'
                                : 'text-[#ff7b72] mt-0.5'
                            }
                          />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <a
                                href={pr.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-bold text-[#f0f6fc] hover:text-[#58a6ff] hover:underline"
                              >
                                {pr.title}
                              </a>
                              <span className="text-[11px] font-mono text-[#8b949e]">#{pr.number}</span>
                              <span
                                className={`text-[10px] px-2 py-0.2 rounded font-mono font-bold uppercase border ${
                                  pr.merged_at
                                    ? 'bg-[#211633] text-[#d2a8ff] border-[#42296d]'
                                    : pr.state === 'open'
                                    ? 'bg-[#122419] text-[#3fb950] border-[#1f4a2b]'
                                    : 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]'
                                }`}
                              >
                                {pr.merged_at ? 'Merged' : pr.state}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-[#8b949e]">
                              <span className="text-[#a371f7]">{pr.head?.ref || 'branch'}</span>
                              <span>→</span>
                              <span className="text-[#79c0ff]">{pr.base?.ref || 'main'}</span>
                            </div>

                            <div className="flex items-center gap-4 mt-2 text-[10px] text-[#6e7681]">
                              <span>Created by {pr.user?.login}</span>
                              <span className="flex items-center gap-1">
                                <Clock size={10} />
                                {new Date(pr.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <a
                          href={pr.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#273855] text-[11px] flex items-center gap-1 flex-shrink-0 transition"
                        >
                          <span>Review PR</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* --- TAB 3: DEPLOYS / WORKFLOWS --- */}
            {activeTab === 'deploys' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xs font-bold text-[#f0f6fc]">GitHub Actions Workflow Deploy Runs</h3>
                    <button
                      onClick={fetchSubData}
                      disabled={dataLoading}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#273855] text-xs font-medium transition"
                      title="Refresh workflow runs from GitHub"
                    >
                      <RefreshCw size={11} className={dataLoading ? 'animate-spin text-[#58a6ff]' : ''} />
                      <span>Refresh Runs</span>
                    </button>
                  </div>
                  <span className="text-xs text-[#8b949e] font-mono">Real-time status via GitHub REST API</span>
                </div>

                {dataLoading && deploys.length === 0 ? (
                  <div className="py-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs text-[#58a6ff] pb-1">
                      <RefreshCw size={12} className="animate-spin" />
                      <span>Checking GitHub Actions workflow runs...</span>
                    </div>
                    <ListItemSkeleton count={3} />
                  </div>
                ) : deploys.length === 0 ? (
                  <div className="p-12 text-center border border-dashed border-[#1b2234] rounded-xl bg-[#0a0e17]">
                    {errorMsg ? (
                      <>
                        <ShieldAlert size={28} className="mx-auto text-[#d29922] mb-2" />
                        <p className="text-xs text-[#f0f6fc] font-semibold">GitHub Actions Runs Unavailable</p>
                        <p className="text-[11px] text-[#ff7b72] mt-1 mb-4">{errorMsg}</p>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={28} className="mx-auto text-[#8b949e] mb-2" />
                        <p className="text-xs text-[#f0f6fc] font-semibold">No GitHub Actions workflow runs found</p>
                        <p className="text-[11px] text-[#8b949e] mt-1 mb-4">
                          Configure <code className="text-[#79c0ff]">.github/workflows</code> in your repo to see live deployment status.
                        </p>
                      </>
                    )}
                    <button
                      onClick={fetchSubData}
                      disabled={dataLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#273855] text-xs font-medium transition"
                    >
                      <RefreshCw size={12} className={dataLoading ? 'animate-spin' : ''} />
                      <span>Check Workflow Runs</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {deploys.map((run) => (
                      <div
                        key={run.id}
                        className="p-4 rounded-lg bg-[#0e1420] border border-[#1b2438] hover:border-[#2b3a5a] transition flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          {run.conclusion === 'success' ? (
                            <CheckCircle2 size={16} className="text-[#3fb950]" />
                          ) : run.conclusion === 'failure' ? (
                            <XCircle size={16} className="text-[#ff7b72]" />
                          ) : (
                            <Clock size={16} className="text-[#d29922] animate-spin" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <a
                                href={run.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-bold text-[#f0f6fc] hover:text-[#58a6ff] hover:underline"
                              >
                                {run.name || 'CI/CD Pipeline'}
                              </a>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-mono uppercase font-bold border ${
                                  run.conclusion === 'success'
                                    ? 'bg-[#122419] text-[#3fb950] border-[#1f4a2b]'
                                    : run.conclusion === 'failure'
                                    ? 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]'
                                    : 'bg-[#241a12] text-[#d29922] border-[#442c16]'
                                }`}
                              >
                                {run.conclusion || run.status}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#8b949e] font-mono">
                              <span>Event: {run.event}</span>
                              <span>•</span>
                              <span>Branch: {run.head_branch}</span>
                              <span>•</span>
                              <span>Commit: {run.head_sha?.slice(0, 7)}</span>
                            </div>
                          </div>
                        </div>

                        <a
                          href={run.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#273855] text-[11px] flex items-center gap-1 transition"
                        >
                          <span>View Logs</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* --- TAB 4: COMMITS --- */}
            {activeTab === 'commits' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xs font-bold text-[#f0f6fc]">Local Repository Git Log</h3>
                    <button
                      onClick={fetchSubData}
                      disabled={dataLoading}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#273855] text-xs font-medium transition"
                      title="Read latest git commits from local repository"
                    >
                      <RefreshCw size={11} className={dataLoading ? 'animate-spin text-[#58a6ff]' : ''} />
                      <span>Refresh Commits</span>
                    </button>
                  </div>
                  <span className="text-xs text-[#8b949e] font-mono">{currentProject?.local_path}</span>
                </div>

                {dataLoading && commits.length === 0 ? (
                  <div className="py-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs text-[#58a6ff] pb-1">
                      <RefreshCw size={12} className="animate-spin" />
                      <span>Reading local git commits...</span>
                    </div>
                    <ListItemSkeleton count={3} />
                  </div>
                ) : commits.length === 0 ? (
                  <div className="p-12 text-center border border-dashed border-[#1b2234] rounded-xl bg-[#0a0e17]">
                    <GitBranch size={28} className="mx-auto text-[#8b949e] mb-2" />
                    <p className="text-xs text-[#f0f6fc] font-semibold">No commits found</p>
                    <p className="text-[11px] text-[#8b949e] mt-1 mb-4">Ensure the local path points to an initialized git directory.</p>
                    <button
                      onClick={fetchSubData}
                      disabled={dataLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#161f30] hover:bg-[#202e47] text-[#79c0ff] border border-[#273855] text-xs font-medium transition"
                    >
                      <RefreshCw size={12} className={dataLoading ? 'animate-spin' : ''} />
                      <span>Scan Local Git Log</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 font-mono text-xs">
                    {commits.map((c, idx) => (
                      <div
                        key={c.hash || idx}
                        className="p-3 rounded-lg bg-[#0e1420] border border-[#1b2438] flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 rounded bg-[#161f30] text-[#79c0ff] border border-[#263550] text-[11px]">
                            {c.hash}
                          </span>
                          <span className="text-[#f0f6fc] font-sans text-xs">{c.message}</span>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] text-[#6e7681] flex-shrink-0">
                          <span>{c.author}</span>
                          <span>{c.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-[#0e1420] border border-[#23314d] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#1b2438] flex items-center justify-between bg-[#121824]">
              <div className="flex items-center gap-2">
                <FolderGit2 size={16} className="text-[#58a6ff]" />
                <h3 className="text-sm font-bold text-[#f0f6fc]">Connect GitHub Project</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#8b949e] hover:text-[#f0f6fc] text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {projectProgress ? (
              <div className="p-6 space-y-5 animate-in fade-in duration-200">
                {/* Status Bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {projectProgress.status === 'running' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-[#58a6ff] animate-ping" />
                    )}
                    {projectProgress.status === 'success' && (
                      <CheckCircle2 size={16} className="text-[#3fb950]" />
                    )}
                    {projectProgress.status === 'error' && (
                      <AlertCircle size={16} className="text-[#f85149]" />
                    )}
                    <span className="text-xs font-bold text-[#f0f6fc] tracking-wide uppercase">
                      {projectProgress.status === 'running'
                        ? 'Initializing & Cloning Project...'
                        : projectProgress.status === 'success'
                        ? 'Project Connected & Ready'
                        : 'Initialization Failed'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#8b949e]">
                    Step {projectProgress.step} of {projectProgress.total_steps}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-[#161f30] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      projectProgress.status === 'error'
                        ? 'bg-[#f85149]'
                        : projectProgress.status === 'success'
                        ? 'bg-[#3fb950]'
                        : 'bg-gradient-to-r from-[#58a6ff] to-[#3fb950]'
                    }`}
                    style={{
                      width: `${(projectProgress.step / projectProgress.total_steps) * 100}%`
                    }}
                  />
                </div>

                {/* Step Cards */}
                <div className="space-y-2.5">
                  {[
                    { num: 1, title: 'Validating GitHub Repository', desc: form.github_repo },
                    { num: 2, title: 'Preparing Local Workspace & Storage', desc: form.local_path || 'Auto-allocated in ~/.prodpilot/projects/' },
                    { num: 3, title: 'Synchronizing Git Repository', desc: 'Cloning tree, objects, and checkout branch' },
                    { num: 4, title: 'Inspecting Codebase & Test Suites', desc: `Test Runner: ${form.test_cmd || 'pytest'}` }
                  ].map((s) => {
                    const isDone = projectProgress.step > s.num || (projectProgress.step === s.num && projectProgress.status === 'success');
                    const isCurrent = projectProgress.step === s.num && projectProgress.status === 'running';
                    const isFailed = projectProgress.step === s.num && projectProgress.status === 'error';

                    return (
                      <div
                        key={s.num}
                        className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all ${
                          isDone
                            ? 'bg-[#121d2f]/60 border-[#23426e] text-[#f0f6fc]'
                            : isCurrent
                            ? 'bg-[#16233b] border-[#388bfd] text-[#58a6ff] shadow-sm shadow-[#388bfd]/20'
                            : isFailed
                            ? 'bg-[#2d1216] border-[#f85149] text-[#ff7b72]'
                            : 'bg-[#090d16]/40 border-[#1a2336] text-[#6e7681]'
                        }`}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {isDone ? (
                            <CheckCircle2 size={15} className="text-[#3fb950]" />
                          ) : isCurrent ? (
                            <RefreshCw size={15} className="text-[#58a6ff] animate-spin" />
                          ) : isFailed ? (
                            <AlertCircle size={15} className="text-[#f85149]" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-[#30363d] flex items-center justify-center text-[9px] font-mono">
                              {s.num}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold leading-tight">{s.title}</div>
                          <div className="text-[11px] text-[#8b949e] truncate mt-0.5">{s.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Live Console Output */}
                <div className="bg-[#05070c] border border-[#1b2438] rounded-lg p-3 font-mono text-[11px] text-[#79c0ff] space-y-1 max-h-32 overflow-y-auto">
                  <div className="text-[10px] text-[#484f58] uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
                    <Terminal size={11} />
                    <span>Project Provisioning Console</span>
                  </div>
                  {projectProgress.logs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-[#c9d1d9]">
                      <span className="text-[#58a6ff] select-none">&gt;</span>
                      <span className="break-all">{log}</span>
                    </div>
                  ))}
                  {projectProgress.status === 'running' && (
                    <div className="flex items-center gap-1 text-[#8b949e]">
                      <span className="inline-block w-1.5 h-3 bg-[#58a6ff] animate-pulse" />
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#1b2438]">
                  {projectProgress.status === 'error' ? (
                    <button
                      type="button"
                      onClick={() => setProjectProgress(null)}
                      className="px-4 py-2 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-[#f0f6fc] text-xs font-semibold transition"
                    >
                      Back to Edit Form
                    </button>
                  ) : projectProgress.status === 'success' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        setProjectProgress(null);
                      }}
                      className="px-5 py-2 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-bold transition flex items-center gap-1.5 shadow"
                    >
                      <CheckCircle2 size={13} />
                      <span>View Project Dashboard</span>
                    </button>
                  ) : (
                    <div className="text-xs text-[#8b949e] flex items-center gap-2">
                      <RefreshCw size={12} className="animate-spin text-[#58a6ff]" />
                      <span>Cloning & configuring...</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#c9d1d9] mb-1">
                  Project Name <span className="text-[#ff7b72]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ChunkStream Video Transcoder"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#080b11] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-lg focus:outline-none focus:border-[#58a6ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#c9d1d9] mb-1">
                  GitHub Repository Slug <span className="text-[#ff7b72]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. vishnunandan555/chunkstream"
                  value={form.github_repo}
                  onChange={(e) => setForm({ ...form, github_repo: e.target.value })}
                  className="w-full bg-[#080b11] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-lg focus:outline-none focus:border-[#58a6ff] font-mono"
                />
                <p className="text-[10px] text-[#8b949e] mt-1">
                  Format: <code className="text-[#79c0ff]">owner/repository</code>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#c9d1d9] mb-1">
                  Project Local Path <span className="text-[#8b949e] font-normal">(Optional — auto-clones if blank)</span>
                </label>
                <input
                  type="text"
                  placeholder="Leave blank to auto-clone to ~/.prodpilot/projects/"
                  value={form.local_path}
                  onChange={(e) => setForm({ ...form, local_path: e.target.value })}
                  className="w-full bg-[#080b11] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-lg focus:outline-none focus:border-[#58a6ff] font-mono"
                />
                <p className="text-[10px] text-[#8b949e] mt-1">
                  Optional. Leave blank to automatically clone from GitHub, or enter an existing folder on this machine.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[#c9d1d9]">
                    GitHub Personal Access Token (PAT) <span className="text-[#8b949e] font-normal">(Optional)</span>
                  </label>
                  <a
                    href="https://github.com/settings/tokens/new?description=ProdPilot+Autonomous+SRE&scopes=repo,workflow,read:user,user:email"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#58a6ff] hover:text-[#79c0ff] hover:underline text-[11px] inline-flex items-center gap-1 font-medium"
                    title="Generate token with pre-selected scopes: repo, workflow, read:user, user:email"
                  >
                    <span>Generate on GitHub</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
                <input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxx (leave blank to use Global PAT from Settings)"
                  value={form.github_token}
                  onChange={(e) => setForm({ ...form, github_token: e.target.value })}
                  className="w-full bg-[#080b11] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-lg focus:outline-none focus:border-[#58a6ff] font-mono"
                />
                <p className="text-[10px] text-[#8b949e] mt-1">
                  Used to fetch private repo issues, PRs, and Actions deploy runs. Falls back to Settings.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#c9d1d9] mb-1">Default Branch</label>
                  <input
                    type="text"
                    value={form.default_branch}
                    onChange={(e) => setForm({ ...form, default_branch: e.target.value })}
                    className="w-full bg-[#080b11] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-lg focus:outline-none focus:border-[#58a6ff] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#c9d1d9] mb-1">Test Command</label>
                  <input
                    type="text"
                    value={form.test_cmd}
                    onChange={(e) => setForm({ ...form, test_cmd: e.target.value })}
                    className="w-full bg-[#080b11] border border-[#222f47] text-xs text-[#f0f6fc] px-3 py-2 rounded-lg focus:outline-none focus:border-[#58a6ff] font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1b2438]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                  className="px-3 py-1.5 rounded-lg bg-[#161f30] hover:bg-[#1f2b40] text-[#c9d1d9] text-xs transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white text-xs font-bold shadow transition flex items-center gap-1.5"
                >
                  {submitting && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  <span>{submitting ? 'Connecting & Cloning...' : 'Connect Project'}</span>
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
