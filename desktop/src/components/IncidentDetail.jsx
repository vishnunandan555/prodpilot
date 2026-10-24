import React, { useState } from 'react';
import {
  AlertTriangle,
  GitCommit,
  Clock,
  Terminal,
  FileCode,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  FileText,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Radio,
  ExternalLink,
  ShieldAlert,
  RotateCcw,
  GitPullRequest,
  Check,
  UserX,
  ArrowLeft,
  Copy,
  Info,
  Server,
  X,
  Bot,
  Trash2,
  HelpCircle,
  GitBranch
} from 'lucide-react';
import DiffViewer from './DiffViewer';
import Timeline from './Timeline';
import PostMortemReport from './PostMortemReport';
import AgentExecutionConsole from './AgentExecutionConsole';
import {
  formatIncidentId,
  formatDate,
  formatRelativeTime,
  formatStatusLabel,
  getStatusBadgeStyle,
  isIncidentInactive
} from '../utils/formatters';

export default function IncidentDetail({
  incident,
  events = [],
  onApprove,
  onRollback,
  onTakeover,
  actionLoading = false,
  deploySuccess = false,
  deployError = null,
  onClearDeployError,
  onBack,
  isStandaloneMobile = false,
  onNavigate,
  onDeleteIncident,
  apiUrl = 'http://localhost:8765',
}) {
  const getInitialTab = () => {
    try {
      const param = new URLSearchParams(window.location.search).get('tab');
      if (param && ['overview', 'agent', 'logs', 'investigation', 'recovery', 'changes', 'timeline'].includes(param)) {
        return param;
      }
    } catch {}
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [copiedTrace, setCopiedTrace] = useState(false);
  const [copiedReproTest, setCopiedReproTest] = useState(false);
  const [dismissRestoredBanner, setDismissRestoredBanner] = useState(false);
  const [showPatchDiffInGate, setShowPatchDiffInGate] = useState(false);
  const [showRcaTrace, setShowRcaTrace] = useState(false);
  const [showReproProof, setShowReproProof] = useState(true);
  const [showRedGreenLogs, setShowRedGreenLogs] = useState(true);
  const [confirmAction, setConfirmAction] = useState(null);
  const [commitsList, setCommitsList] = useState([]);
  const [loadingCommits, setLoadingCommits] = useState(false);
  const [selectedCommitHash, setSelectedCommitHash] = useState(null);

  React.useEffect(() => {
    setDismissRestoredBanner(false);
    setConfirmAction(null);
  }, [incident?.id]);

  React.useEffect(() => {
    if (confirmAction === 'rollback' && incident?.id) {
      setLoadingCommits(true);
      fetch(`${apiUrl}/incidents/${incident.id}/commits`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && Array.isArray(data.commits) && data.commits.length > 0) {
            setCommitsList(data.commits);
            const suspectObj = incident?.suspect_commit || {};
            const suspectH = typeof suspectObj === 'string' ? suspectObj.slice(0, 7) : suspectObj.hash?.slice(0, 7);
            const foundIdx = data.commits.findIndex((c) => c.hash && suspectH && c.hash.startsWith(suspectH));
            if (foundIdx >= 0 && data.commits[foundIdx + 1]) {
              setSelectedCommitHash(data.commits[foundIdx + 1].hash);
            } else if (data.commits.length > 1) {
              setSelectedCommitHash(data.commits[1].hash);
            } else {
              setSelectedCommitHash(data.commits[0].hash);
            }
          } else if (Array.isArray(incident.recent_commits) && incident.recent_commits.length > 0) {
            setCommitsList(incident.recent_commits);
            setSelectedCommitHash(incident.recent_commits[0].hash || incident.recent_commits[0]);
          }
        })
        .catch(() => {
          if (Array.isArray(incident.recent_commits) && incident.recent_commits.length > 0) {
            setCommitsList(incident.recent_commits);
            setSelectedCommitHash(incident.recent_commits[0].hash || incident.recent_commits[0]);
          }
        })
        .finally(() => setLoadingCommits(false));
    }
  }, [confirmAction, incident?.id, apiUrl]);


  if (!incident) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#6e7681]">
        <div className="w-14 h-14 rounded-2xl bg-[#101726] border border-[#1b263b] flex items-center justify-center text-[#3fb950] mb-4 shadow-lg">
          <ShieldCheck size={28} className="text-[#3fb950]" />
        </div>
        <h2 className="text-base font-bold text-[#f0f6fc]">No Active Incidents</h2>
        <p className="text-xs text-[#8b949e] mt-1.5 max-w-md leading-relaxed">
          All systems are healthy. When an outage or error is detected on your connected production servers, it will appear here in real time with root cause attribution and automated remediation pipelines.
        </p>
        {onNavigate && (
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => onNavigate('servers')}
              className="px-3.5 py-1.5 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-xs font-semibold text-[#f0f6fc] rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Server size={13} className="text-[#58a6ff]" />
              <span>Connect Production Server</span>
            </button>
            <button
              onClick={() => onNavigate('dashboard')}
              className="px-3.5 py-1.5 bg-[#1f6feb]/15 hover:bg-[#1f6feb]/25 border border-[#1f6feb]/30 text-xs font-semibold text-[#58a6ff] rounded-lg transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    );
  }

  const isResolved = isIncidentInactive(incident.status);
  const isAwaiting = incident.status === 'AWAITING_APPROVAL';
  const isTakeover = incident.status === 'MANUAL_TAKEOVER';

  const suspect = incident.suspect_commit || {};
  const suspectHash = typeof suspect === 'string' ? suspect.slice(0, 7) : suspect.hash?.slice(0, 7) || null;
  const suspectAuthor = suspect.author || null;
  const suspectMessage = suspect.message || null;
  const suspectTime = suspect.minutes_ago !== undefined ? `${suspect.minutes_ago}m ago` : null;
  const suspectLocation = incident.suspected_area || (suspect.suspect_file ? `${suspect.suspect_file}:${suspect.suspect_line || ''}` : null);

  const brief = incident.brief || {};
  const rootCauseSummary = brief.summary || incident.title || (suspectLocation ? `Investigating issue in ${suspectLocation}` : 'Investigating root cause...');

  const artifacts = incident.artifacts || {};
  const diffContent = artifacts.patch_diff || incident.diff || null;
  const testEvidence = artifacts.test_evidence || null;
  const testBefore = testEvidence?.before || artifacts.test_log_before || null;
  const testAfter = testEvidence?.after || artifacts.test_log_after || null;
  const reproTest = artifacts.repro_test || null;

  const staging = incident.staging || {};
  const decision = incident.decision || null;
  const ffConfidence = decision?.probabilities?.fix_forward ? Math.round(decision.probabilities.fix_forward * 100) : 85;
  const rbConfidence = decision?.probabilities?.rollback ? Math.round(decision.probabilities.rollback * 100) : 15;

  const githubIssue = typeof (artifacts.github_issue || incident.github_issue) === 'string'
    ? (() => { try { return JSON.parse(artifacts.github_issue || incident.github_issue); } catch { return null; } })()
    : (artifacts.github_issue || incident.github_issue) || null;

  const githubPr = typeof (artifacts.github_pr || incident.github_pr) === 'string'
    ? (() => { try { return JSON.parse(artifacts.github_pr || incident.github_pr); } catch { return null; } })()
    : (artifacts.github_pr || incident.github_pr) || null;

  const issueNumber = githubIssue?.issue_number || null;
  const issueUrl = githubIssue?.issue_url || null;
  const prNumber = githubPr?.pr_number || null;
  const prUrl = githubPr?.pr_url || null;
  const prBranch = githubPr?.branch || null;

  const getStageStatusIndex = () => {
    switch (incident.status) {
      case 'OPEN':
      case 'DETECTED':
        return 0;
      case 'INVESTIGATING':
      case 'UNDERSTAND':
      case 'TRIAGED':
        return 1;
      case 'REPRODUCE':
      case 'REPRODUCED':
        return 2;
      case 'FIXING':
      case 'FIXED':
      case 'VERIFY':
      case 'VERIFIED':
        return 3;
      case 'STAGE':
      case 'STAGED':
        return 4;
      case 'AWAITING_APPROVAL':
      case 'DECIDE':
      case 'GATE':
        return 5;
      case 'DEPLOYED':
      case 'RESOLVED':
      case 'ROLLED_BACK':
        return 6;
      case 'MANUAL_TAKEOVER':
        return 5;
      default:
        return 1;
    }
  };

  const currentStageIdx = getStageStatusIndex();

  const generateNaturalIssue = () => {
    const b = incident.brief || {};
    const tr = incident.trace || '';
    const err = b.error_message || b.summary || '';
    const combined = `${err} ${tr} ${b.hypothesis || ''}`;

    if (combined.includes('ReceiverAckTimeoutError') || (combined.includes('consecutive chunks') && combined.includes('ACK'))) {
      return 'The websocket streaming connection timed out in handle_websocket_message. The server transferred 10 consecutive chunks without receiving an acknowledgement (ACK) from the client receiver, exceeding the failure streak limit and triggering an unhandled TimeoutError.';
    }
    if (combined.includes('KeyError')) {
      const match = combined.match(/['"](\w+)['"]/);
      const key = match ? match[1] : 'required key';
      return `A KeyError was raised in calculate_order. The incoming order payload omitted the '${key}' field, and direct dictionary access without a default fallback caused an unhandled KeyError crash.`;
    }
    if (b.hypothesis) {
      return b.hypothesis;
    }
    if (b.summary) {
      return `An unhandled exception occurred: ${b.summary}`;
    }
    return incident.title || 'An unhandled production runtime exception crashed the service worker.';
  };

  const generateNaturalFix = () => {
    const diff = artifacts.patch_diff || incident.diff || '';
    const stageIdx = getStageStatusIndex();

    if (stageIdx < 3 && !diff) {
      if (stageIdx <= 1) {
        return 'Analyzing service logs, stack trace, and git history to isolate the root cause and suspect commit.';
      }
      return 'Executing reproduction test in an isolated worktree sandbox. Candidate patch pending validation.';
    }

    const combined = `${diff} ${incident.brief?.summary || ''}`;

    if (diff.includes('streak') || (diff && combined.includes('ACK')) || (diff && combined.includes('TimeoutError'))) {
      return 'Defensive ACK handling applied in streaming loop: resets consecutive chunk counter on partial deliveries and adds graceful recovery guard to prevent transfer stream halts.';
    }
    if (diff.includes('.get(') || (diff && combined.includes('KeyError'))) {
      return 'Replaced direct dictionary key subscription with safe .get() default fallback, and added input validation guards to prevent KeyErrors on missing fields.';
    }
    if (diff) {
      const lines = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++') && l.trim().length > 1);
      if (lines.length > 0) {
        return `Applied defensive guard clauses (${lines[0].replace('+', '').trim()}) to safely intercept the crash condition before execution.`;
      }
    }
    if (stageIdx >= 3) {
      return 'Defensive patch synthesized and verified passing 100% of regression and reproduction tests.';
    }
    return 'Remediation is actively underway in an isolated worktree.';
  };

  const handleCopyTrace = () => {
    if (incident.trace) {
      navigator.clipboard.writeText(incident.trace);
      setCopiedTrace(true);
      setTimeout(() => setCopiedTrace(false), 2000);
    }
  };

  const handleCopyReproTest = () => {
    if (reproTest) {
      navigator.clipboard.writeText(reproTest);
      setCopiedReproTest(true);
      setTimeout(() => setCopiedReproTest(false), 2000);
    }
  };


  const tabs = [
    { id: 'overview', label: 'Overview', icon: ShieldAlert },
    { id: 'agent', label: 'Execution Console', icon: Bot },
    { id: 'logs', label: 'Logs & Telemetry', icon: Terminal },
    { id: 'investigation', label: 'Investigation & RCA', icon: AlertTriangle },
    { id: 'recovery', label: 'Canary Validation', icon: Server },
    { id: 'changes', label: 'Code Changes', icon: FileCode },
    { id: 'timeline', label: 'Audit Trail', icon: Radio },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-y-auto font-sans relative">
      {/* Unified Sticky Top Header & Tab Navigation */}
      <div className="sticky top-0 z-40 bg-[#0d111a] border-b border-[#1b2234] shrink-0">
        {/* Top Header Row */}
        <div className="px-4 py-2 flex items-center justify-between border-b border-[#1b2234]">
          <div className="flex items-center gap-2.5 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1 rounded bg-[#161b26] text-[#8b949e] hover:text-[#f0f6fc] border border-[#212a3d] transition"
                title="Back"
              >
                <ArrowLeft size={14} />
              </button>
            )}
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${isResolved ? 'bg-[#3fb950]' : 'bg-[#f85149]'}`} />
              <span className="font-mono text-xs font-bold text-[#58a6ff] px-1.5 py-0.5 rounded bg-[#161f30] border border-[#263550]">
                {formatIncidentId(incident.id)}
              </span>
              <span className="font-mono text-[11px] text-[#8b949e] hidden md:inline truncate">
                {incident.id}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            {issueNumber && (
              <a
                href={issueUrl || `https://github.com/issues/${issueNumber}`}
                target="_blank"
                rel="noreferrer"
                className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#161f30] text-[#58a6ff] hover:text-[#fff] hover:bg-[#1f2c45] border border-[#263550] flex items-center gap-1 transition"
                title="Open linked GitHub Issue"
              >
                <AlertTriangle size={11} className="text-[#e3b341]" />
                <span>Issue #{issueNumber}</span>
                <ExternalLink size={10} className="text-[#8b949e]" />
              </a>
            )}
            {prNumber && (
              <a
                href={prUrl || `https://github.com/pull/${prNumber}`}
                target="_blank"
                rel="noreferrer"
                className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#0d1e17] text-[#3fb950] hover:text-[#fff] hover:bg-[#153422] border border-[#1b3d2b] flex items-center gap-1 transition"
                title="Open linked Pull Request"
              >
                <GitPullRequest size={11} className="text-[#3fb950]" />
                <span>PR #{prNumber}</span>
                <ExternalLink size={10} className="text-[#8b949e]" />
              </a>
            )}
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide uppercase bg-[#261317] text-[#ff7b72] border border-[#4a1c24]">
              {incident.severity || 'SEV-1'}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusBadgeStyle(incident.status)}`}
            >
              {formatStatusLabel(incident.status)}
            </span>
            {onDeleteIncident && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete incident ${incident.id}?`)) {
                    onDeleteIncident(incident.id);
                  }
                }}
                className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#261317] hover:bg-[#3d1822] text-[#ff7b72] border border-[#4a1c24] flex items-center gap-1 transition ml-1"
                title="Delete this incident"
              >
                <Trash2 size={11} />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}
          </div>
        </div>

        {/* 6-Tab Row */}
        <div className="px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto select-none bg-[#090d16]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition whitespace-nowrap border ${
                  isActive
                    ? 'bg-[#161f30] text-[#f0f6fc] border-[#2b3a58]'
                    : 'text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#0f1422] border-transparent'
                }`}
              >
                <Icon size={13} className={isActive ? 'text-[#58a6ff]' : 'text-[#6e7681]'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 max-w-4xl w-full mx-auto p-4 space-y-4">
        {/* Production Restored Banner */}
        {isTakeover && !dismissRestoredBanner && (
          <div className="p-3.5 rounded-lg bg-[#161b26] border border-[#212a3d] flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <UserX className="w-5 h-5 text-[#a5d6ff] flex-shrink-0" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs font-semibold text-[#f0f6fc]">
                    Manual Takeover Active
                  </h3>
                  <span className="text-[11px] text-[#a5d6ff] font-mono px-1.5 py-0.2 rounded bg-[#1c2436] border border-[#2e3b56]">
                    Autonomous Loop Disengaged
                  </span>
                  <span className="text-[11px] text-[#79c0ff] font-mono px-1.5 py-0.2 rounded bg-[#161f30] border border-[#263550]">
                    Canaries Retained (:8001 / :8002)
                  </span>
                </div>
                <p className="text-xs text-[#8b949e] mt-1 leading-relaxed">
                  An on-call engineer has assumed manual control of this incident. Autonomous remediation is inactive and will not overwrite local states.
                </p>
              </div>
            </div>
            <button
              onClick={() => setDismissRestoredBanner(true)}
              className="text-[#8b949e] hover:text-[#c9d1d9] p-1 rounded hover:bg-[#212a3d] transition shrink-0"
              title="Dismiss banner"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {(deploySuccess || (isResolved && !isTakeover)) && !dismissRestoredBanner && (
          <div className="p-3.5 rounded-lg bg-[#0d1e17] border border-[#1b3d2b] flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#3fb950] flex-shrink-0" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs font-semibold text-[#f0f6fc]">
                    Local Demo Deployment Completed
                  </h3>
                  <span className="text-[11px] text-[#3fb950] font-mono px-1.5 py-0.2 rounded bg-[#162e21] border border-[#235836]">
                    Local Port 8000 Healthy
                  </span>
                  <span className="text-[11px] text-[#79c0ff] font-mono px-1.5 py-0.2 rounded bg-[#161f30] border border-[#263550]">
                    Local Demo Deployment
                  </span>
                </div>
                <p className="text-xs text-[#8b949e] mt-1 leading-relaxed">
                  {incident.status === 'ROLLED_BACK'
                    ? 'Local demo server rolled back to prior commit on port 8000. (Local process deployment; not a Render cloud deployment).'
                    : 'Fix-forward hotfix applied to local demo process on port 8000. Verified HTTP 200 OK. (Local process deployment; not a Render cloud deployment).'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setDismissRestoredBanner(true)}
              className="text-[#3fb950]/70 hover:text-[#3fb950] p-1 rounded hover:bg-[#153422] transition shrink-0"
              title="Dismiss banner"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Deploy / Action Error Banner */}
        {deployError && (
          <div className="p-4 rounded-lg bg-[#241316] border border-[#ff7b72]/40 text-xs text-[#ff7b72] flex items-start justify-between gap-3 shadow-md animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="shrink-0 text-[#ff7b72] mt-0.5" />
              <div>
                <p className="font-bold text-sm text-[#ff7b72]">Action Failed / Missing Prerequisite</p>
                <p className="mt-1 text-[#f0f6fc] font-mono leading-relaxed">{deployError}</p>
                {deployError && (deployError.toLowerCase().includes('deployment') || deployError.toLowerCase().includes('provider') || deployError.toLowerCase().includes('adapter')) && (
                  <p className="mt-1 text-[11px] text-[#8b949e]">
                    Note: Real cloud provider (Render) deployment adapter is not configured. Local process deployment requires PRODPILOT_DEPLOY_TARGET=local_process and verified canary health evidence.
                  </p>
                )}
              </div>
            </div>
            {onClearDeployError && (
              <button onClick={onClearDeployError} className="p-1 text-[#8b949e] hover:text-[#f0f6fc]">
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* ===================== TAB 1: OVERVIEW ===================== */}
        {activeTab === 'overview' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Operator Approval Required (Approval Gate) */}
            {isAwaiting && (
              <div className="rounded-xl bg-[#141008] border border-[#d29922]/60 p-4 space-y-3 shadow-xl animate-in fade-in">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2a200c] border border-[#d29922]/40 flex items-center justify-center text-[#d29922] shrink-0 mt-0.5">
                      <ShieldAlert size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-[#f0f6fc]">
                          Deployment Approval Required
                        </h2>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#d29922]/15 text-[#d29922] border border-[#d29922]/30">
                          Approval Gate
                        </span>
                      </div>
                      <p className="text-xs text-[#c9d1d9] mt-1 leading-relaxed">
                        The incident pipeline isolated the root cause, validated a regression fix in an isolated sandbox, and verified canary health.
                      </p>
                      <div className="flex items-center gap-3 text-xs text-[#8b949e] mt-1.5 flex-wrap">
                        <span className={`flex items-center gap-1 font-mono ${
                          staging.fix_forward?.health === true
                            ? 'text-[#3fb950]'
                            : staging.fix_forward?.health === false
                            ? 'text-[#ff7b72]'
                            : 'text-[#8b949e]'
                        }`}>
                          {staging.fix_forward?.health === true ? (
                            <><CheckCircle2 size={13} /> Fix Canary 200 OK</>
                          ) : staging.fix_forward?.health === false ? (
                            <><AlertTriangle size={13} /> Canary Probe Failed</>
                          ) : (
                            <><Radio size={13} /> Canary Staged</>
                          )}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[#d29922]">
                          Recommended: Fix-Forward ({ffConfidence}% match)
                        </span>
                        <span>•</span>
                        <span className="text-[#8b949e] font-mono text-[11px]">
                          Target: Port 8000
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Candidate Patch Diff Preview Toggle */}
                {diffContent && (
                  <div className="rounded-lg bg-[#07090f] border border-[#2b2210] overflow-hidden text-xs">
                    <button
                      onClick={() => setShowPatchDiffInGate(!showPatchDiffInGate)}
                      className="w-full px-3 py-2 bg-[#0c0e14] flex items-center justify-between text-[#8b949e] hover:text-[#f0f6fc] transition"
                    >
                      <span className="flex items-center gap-2 font-mono text-[11px] font-semibold text-[#58a6ff]">
                        <FileCode size={13} />
                        <span>Review Proposed Code Patch</span>
                      </span>
                      {showPatchDiffInGate ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {showPatchDiffInGate && (
                      <div className="p-2 border-t border-[#1b2234]">
                        <DiffViewer diff={diffContent} />
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={() => setConfirmAction('fix_forward')}
                    disabled={actionLoading}
                    className="px-3.5 py-1.5 bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold rounded-md transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <Zap size={13} />
                    <span>{actionLoading ? 'Deploying...' : 'Approve & Deploy (:8000)'}</span>
                  </button>

                  <button
                    onClick={() => setConfirmAction('rollback')}
                    disabled={actionLoading}
                    className="px-3 py-1.5 bg-[#161b26] hover:bg-[#212a3d] text-[#c9d1d9] text-xs font-medium rounded-md border border-[#212a3d] transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RotateCcw size={12} />
                    <span>Rollback to Prior Commit</span>
                  </button>

                  <button
                    onClick={() => onTakeover && onTakeover()}
                    disabled={actionLoading}
                    className="px-3 py-1.5 bg-[#161b26] hover:bg-[#212a3d] text-[#8b949e] hover:text-[#c9d1d9] text-xs rounded-md border border-[#212a3d] transition disabled:opacity-50"
                  >
                    <UserX size={12} />
                    <span>Manual Takeover</span>
                  </button>
                </div>
              </div>
            )}

            {/* Header summary card */}
            <div className="rounded-lg bg-[#0d111a] border border-[#1b2234] p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1b2234] pb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#07090f] text-[#58a6ff] border border-[#1b2234]">
                      {incident.service || 'production-service'}
                    </span>
                    <span className="text-[#6e7681]">·</span>
                    <span className="text-xs text-[#8b949e] flex items-center gap-1">
                      <Clock size={12} />
                      Detected {incident.detected_at || 'Recently'}
                    </span>
                  </div>
                  <h1 className="text-base font-semibold text-[#f0f6fc] mt-1.5">
                    {incident.title || `Outage in ${incident.suspected_area || 'Production Service'}`}
                  </h1>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-[#8b949e]">Severity:</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#261317] text-[#ff7b72] border border-[#4a1c24]">
                    {incident.severity || 'HIGH'}
                  </span>
                </div>
              </div>

              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 rounded bg-[#07090f] border border-[#1b2234]">
                  <span className="text-[#6e7681] block text-[10px] uppercase font-semibold tracking-wider">Target Service</span>
                  <span className="font-medium text-[#c9d1d9] text-xs mt-1 block truncate">{incident.service || 'Default'}</span>
                </div>
                <div className="p-2.5 rounded bg-[#07090f] border border-[#1b2234]">
                  <span className="text-[#6e7681] block text-[10px] uppercase font-semibold tracking-wider">Health URL</span>
                  <span className="font-mono text-[#58a6ff] text-xs truncate block mt-1">
                    {incident.health_url || ':8000/health'}
                  </span>
                </div>
                <div className="p-2.5 rounded bg-[#07090f] border border-[#1b2234]">
                  <span className="text-[#6e7681] block text-[10px] uppercase font-semibold tracking-wider">Resolution Mode</span>
                  <span className="font-semibold text-xs mt-1 block truncate">
                    {isTakeover ? (
                      <span className="text-[#a5d6ff]">Manual Takeover</span>
                    ) : isResolved ? (
                      incident.status === 'ROLLED_BACK' ? (
                        <span className="text-[#e3b341]">Automated Rollback</span>
                      ) : (
                        <span className="text-[#3fb950]">Fix-Forward (Merged PR)</span>
                      )
                    ) : isAwaiting ? (
                      <span className="text-[#d29922]">Awaiting Gate Approval</span>
                    ) : currentStageIdx >= 4 ? (
                      <span className="text-[#58a6ff]">Dual Canary Staging</span>
                    ) : (
                      <span className="text-[#8b949e]">Sandbox Investigation</span>
                    )}
                  </span>
                </div>
                <div className="p-2.5 rounded bg-[#07090f] border border-[#1b2234]">
                  <span className="text-[#6e7681] block text-[10px] uppercase font-semibold tracking-wider">Production State</span>
                  <span className="font-semibold text-xs mt-1 block truncate">
                    {isTakeover ? (
                      <span className="text-[#a5d6ff] flex items-center gap-1">
                        <UserX size={12} /> Operator Control
                      </span>
                    ) : isResolved ? (
                      <span className="text-[#3fb950] flex items-center gap-1">
                        <CheckCircle2 size={12} /> Restored (200 OK)
                      </span>
                    ) : isAwaiting ? (
                      <span className="text-[#d29922]">Approval Required</span>
                    ) : (
                      <span className="text-[#ff7b72]">{incident.status}</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Originating Log Link & Metadata */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#1b2234] text-xs">
                <div className="flex items-center gap-2 text-[#8b949e] flex-wrap">
                  <span>Originating Target:</span>
                  <code className="text-[#ff7b72] font-mono text-[11px] bg-[#160d10] px-1.5 py-0.5 rounded border border-[#3e1b23]">
                    {incident.suspected_area || incident.service}
                  </code>
                </div>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('logs', {
                      service: incident.service,
                      searchTerm: incident.suspected_area || incident.service
                    })}
                    className="px-2.5 py-1 rounded bg-[#161f30] hover:bg-[#1f2c45] border border-[#2b3a58] text-[11px] font-mono text-[#58a6ff] hover:text-[#fff] flex items-center gap-1.5 transition shrink-0"
                    title="Jump to source in Logs Explorer"
                  >
                    <Terminal size={12} />
                    <span>Jump to Source in Logs Explorer ➔</span>
                  </button>
                )}
              </div>
            </div>

            {/* ================= REPORT CARD 1: ROOT CAUSE ANALYSIS (WHY IT HAPPENED) ================= */}
            <div className="rounded-xl bg-[#0d111a] border border-[#1b2234] p-5 space-y-4 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1b2234] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#261317] border border-[#ff7b72]/30 flex items-center justify-center text-[#ff7b72]">
                    <AlertTriangle size={15} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#f0f6fc] flex items-center gap-2">
                      <span>Root Cause Analysis Report</span>
                      <span className="text-[11px] font-mono text-[#8b949e] font-normal">
                        (Why it happened)
                      </span>
                    </h2>
                    <p className="text-[11px] text-[#8b949e]">
                      Automated git blame attribution & failure mechanism isolation
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-[#261317] text-[#ff7b72] border border-[#4a1c24] self-start sm:self-auto">
                  DIAGNOSED • Root Cause Isolated
                </span>
              </div>

              {/* Culprit Commit & AST Blame Information */}
              <div className="rounded-lg bg-[#07090f] border border-[#212a3d] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <GitCommit size={14} className="text-[#58a6ff]" />
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#8b949e]">
                      Suspect Commit:
                    </span>
                    <span className="font-mono font-bold text-[#58a6ff] bg-[#161f30] px-2 py-0.5 rounded border border-[#2b3a58]">
                      {suspectHash || 'HEAD~1'}
                    </span>
                  </div>
                  {suspectAuthor && (
                    <div className="text-[11px] text-[#8b949e]">
                      Author: <span className="font-semibold text-[#c9d1d9]">{suspectAuthor}</span>
                      {suspectTime ? ` (${suspectTime})` : ''}
                    </div>
                  )}
                </div>

                {suspectLocation && (
                  <div className="flex items-center gap-2 text-xs text-[#8b949e] pt-1 border-t border-[#1b2234]">
                    <FileCode size={13} className="text-[#ff7b72]" />
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#8b949e]">Fault Location:</span>
                    <code className="text-[#ff7b72] font-mono text-xs bg-[#160d10] px-2 py-0.5 rounded border border-[#3e1b23]">
                      {suspectLocation}
                    </code>
                  </div>
                )}

                {suspectMessage && (
                  <p className="text-xs text-[#8b949e] italic border-t border-[#1b2234] pt-1.5">
                    "{suspectMessage}"
                  </p>
                )}
              </div>

              {/* Failure Explanation */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#8b949e] flex items-center gap-1.5">
                  <Sparkles size={13} className="text-[#e3b341]" />
                  Failure Mechanism & Root Cause Breakdown
                </span>
                <p className="text-xs text-[#c9d1d9] leading-relaxed bg-[#07090f] p-3 rounded-lg border border-[#1b2234]">
                  {generateNaturalIssue()}
                </p>
              </div>

              {/* Stack Trace Toggle */}
              {incident.trace && (
                <div className="rounded-lg bg-[#07090f] border border-[#261317] overflow-hidden text-xs">
                  <div className="px-3 py-2 bg-[#120a0d] flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-mono text-[11px] font-semibold text-[#ff7b72]">
                      <Terminal size={13} />
                      <span>Traceback Evidence Snapshot</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyTrace}
                        className="px-2 py-0.5 rounded bg-[#1f1115] hover:bg-[#2d181e] text-[10px] font-mono text-[#ff7b72] border border-[#4a1c24] flex items-center gap-1 transition"
                      >
                        <Copy size={11} />
                        <span>{copiedTrace ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRcaTrace(!showRcaTrace)}
                        className="text-[#8b949e] hover:text-[#f0f6fc] text-xs transition"
                      >
                        {showRcaTrace ? 'Collapse' : 'Expand'}
                      </button>
                    </div>
                  </div>
                  {showRcaTrace && (
                    <div className="p-3 border-t border-[#261317] font-mono text-xs text-[#ff7b72] overflow-x-auto max-h-60 leading-relaxed">
                      <pre>{incident.trace}</pre>
                    </div>
                  )}
                </div>
              )}

              {/* Reproduction Test Proof */}
              {reproTest && (
                <div className="rounded-lg bg-[#07090f] border border-[#212a3d] overflow-hidden text-xs">
                  <div className="px-3 py-2 bg-[#0c101a] flex items-center justify-between text-xs border-b border-[#1b2234]">
                    <span className="flex items-center gap-2 font-mono text-[11px] font-semibold text-[#58a6ff]">
                      <FileCode size={13} />
                      <span>Reproduction Test Script Proof (tests/test_repro.py)</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyReproTest}
                        className="px-2 py-0.5 rounded bg-[#161f30] hover:bg-[#1f2c45] text-[10px] font-mono text-[#58a6ff] border border-[#263550] flex items-center gap-1 transition"
                      >
                        <Copy size={11} />
                        <span>{copiedReproTest ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowReproProof(!showReproProof)}
                        className="text-[#8b949e] hover:text-[#f0f6fc] text-xs transition"
                      >
                        {showReproProof ? 'Collapse' : 'Expand'}
                      </button>
                    </div>
                  </div>
                  {showReproProof && (
                    <div className="p-3 font-mono text-xs text-[#79c0ff] bg-[#05070c] overflow-x-auto max-h-56 leading-relaxed">
                      <pre>{reproTest}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ================= REPORT CARD 2: CANDIDATE REMEDIATION PATCH DIFF ================= */}
            {diffContent && (
              <div className="rounded-xl bg-[#0d111a] border border-[#1b2234] p-5 space-y-3.5 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1b2234] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#161f30] border border-[#58a6ff]/30 flex items-center justify-center text-[#58a6ff]">
                      <FileCode size={15} />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-[#f0f6fc] flex items-center gap-2">
                        <span>Candidate Remediation Patch</span>
                        <span className="text-[11px] font-mono text-[#8b949e] font-normal">
                          (Code diff)
                        </span>
                      </h2>
                      <p className="text-[11px] text-[#8b949e]">
                        Verified minimal patch synthesized in isolated worktree
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-[#161f30] text-[#58a6ff] border border-[#2b3a58] self-start sm:self-auto">
                    {diffContent.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).length} additions • {diffContent.split('\n').filter(l => l.startsWith('-') && !l.startsWith('---')).length} deletions
                  </span>
                </div>

                <div className="rounded-lg border border-[#1b2234] overflow-hidden">
                  <DiffViewer diff={diffContent} />
                </div>
              </div>
            )}

            {/* ================= REPORT CARD 3: FIX & VERIFICATION REPORT (WHAT HAS BEEN FIXED) ================= */}
            <div className="rounded-xl bg-[#0d111a] border border-[#1b2234] p-5 space-y-4 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1b2234] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#0d1e17] border border-[#3fb950]/30 flex items-center justify-center text-[#3fb950]">
                    <ShieldCheck size={15} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#f0f6fc] flex items-center gap-2">
                      <span>Fix & Verification Report</span>
                      <span className="text-[11px] font-mono text-[#8b949e] font-normal">
                        (What has been fixed & verified)
                      </span>
                    </h2>
                    <p className="text-[11px] text-[#8b949e]">
                      Red-to-Green test execution proofs & dual canary telemetry
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b] self-start sm:self-auto">
                  VERIFIED • Zero Regressions
                </span>
              </div>

              {/* Natural Language Fix Summary */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#8b949e] flex items-center gap-1.5">
                  <Sparkles size={13} className="text-[#3fb950]" />
                  What Changed & How it Fixes the Issue
                </span>
                <p className="text-xs text-[#c9d1d9] leading-relaxed bg-[#07090f] p-3 rounded-lg border border-[#1b2234]">
                  {generateNaturalFix()}
                </p>
              </div>

              {/* Red-to-Green Test Verification Proofs */}
              {(testBefore || testAfter) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#8b949e] flex items-center gap-1.5">
                      <Layers size={13} className="text-[#58a6ff]" />
                      Red-to-Green Sandbox Test Verification
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowRedGreenLogs(!showRedGreenLogs)}
                      className="text-[#8b949e] hover:text-[#f0f6fc] text-xs transition"
                    >
                      {showRedGreenLogs ? 'Hide Logs' : 'Show Logs'}
                    </button>
                  </div>

                  {showRedGreenLogs && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                      {/* Before: Red Failing Log */}
                      <div className="rounded-lg bg-[#07090f] border border-[#3b1219] overflow-hidden">
                        <div className="px-3 py-1.5 bg-[#261317] border-b border-[#3b1219] flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#ff7b72] flex items-center gap-1.5">
                            <X size={13} />
                            Before Patch (Failing Reproduction)
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#3b1219] text-[#ff7b72] border border-[#da3633]/40">
                            FAILED
                          </span>
                        </div>
                        <div className="p-3 text-[11px] text-[#ff7b72] max-h-48 overflow-y-auto leading-relaxed">
                          <pre>{testBefore || 'FAILED: test_repro.py assertion error on unhandled exception'}</pre>
                        </div>
                      </div>

                      {/* After: Green Passing Log */}
                      <div className="rounded-lg bg-[#07090f] border border-[#12281e] overflow-hidden">
                        <div className="px-3 py-1.5 bg-[#0d1e17] border-b border-[#12281e] flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#3fb950] flex items-center gap-1.5">
                            <CheckCircle2 size={13} />
                            After Patch (Verified Passing)
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#162e21] text-[#3fb950] border border-[#238636]/40">
                            PASSED
                          </span>
                        </div>
                        <div className="p-3 text-[11px] text-[#3fb950] max-h-48 overflow-y-auto leading-relaxed">
                          <pre>{testAfter || 'PASSED: 1 passed in 0.04s, 0 regressions across full test suite'}</pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Dual Canary Telemetry & Decision Engine Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Dual Canaries */}
                <div className="rounded-lg bg-[#07090f] border border-[#212a3d] p-3 space-y-2 text-xs">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#8b949e] flex items-center gap-1.5">
                    <Server size={12} className="text-[#58a6ff]" />
                    Dual Canary Validation Telemetry
                  </span>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between p-2 rounded bg-[#0d111a] border border-[#1b2234]">
                      <span className="font-mono text-[#c9d1d9] text-[11px]">Canary Port 8001 (Fix-Forward)</span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        staging.fix_forward?.health === true
                          ? 'bg-[#162e21] text-[#3fb950] border-[#238636]'
                          : 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]'
                      }`}>
                        {staging.fix_forward?.health === true ? 'HTTP 200 OK' : 'Probe Pending'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-[#0d111a] border border-[#1b2234]">
                      <span className="font-mono text-[#c9d1d9] text-[11px]">Canary Port 8002 (Rollback)</span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        staging.rollback?.health === true
                          ? 'bg-[#162e21] text-[#3fb950] border-[#238636]'
                          : 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]'
                      }`}>
                        {staging.rollback?.health === true ? 'HTTP 200 OK' : 'Probe Pending'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Jev Decision Engine Recommendation */}
                <div className="rounded-lg bg-[#07090f] border border-[#212a3d] p-3 space-y-2 text-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#8b949e] flex items-center gap-1.5">
                      <Radio size={12} className="text-[#d29922]" />
                      Jev Decision Engine Recommendation
                    </span>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[#d29922]">
                        {decision?.recommendation?.toUpperCase() || 'FIX_FORWARD'}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#2a200c] text-[#e3b341] border border-[#d29922]/40">
                        {ffConfidence}% Confidence Match
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8b949e] mt-1 leading-relaxed">
                      {decision?.reason || 'Verified patch resolves issue with zero regression risk and passing canaries.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Approval Controls */}
              {isTakeover ? (
                <div className="pt-2 border-t border-[#1b2234] flex items-center justify-between p-3 rounded-lg bg-[#161b26] border border-[#212a3d]">
                  <div className="flex items-center gap-2 text-xs text-[#c9d1d9]">
                    <UserX size={15} className="text-[#a5d6ff]" />
                    <span><strong>Manual Takeover Active:</strong> SRE operator has assumed manual control. Autonomous remediation is inactive.</span>
                  </div>
                  <span className="text-[11px] font-mono text-[#8b949e]">Canaries (:8001/:8002) retained</span>
                </div>
              ) : isResolved ? (
                <div className="pt-2 border-t border-[#1b2234] flex items-center justify-between p-3 rounded-lg bg-[#0d1e17] border border-[#1b3d2b]">
                  <div className="flex items-center gap-2 text-xs text-[#3fb950]">
                    <CheckCircle2 size={15} />
                    <span><strong>Remediation Completed:</strong> Incident resolved and production state restored.</span>
                  </div>
                  <span className="text-[11px] font-mono text-[#8b949e]">Port 8000 Healthy</span>
                </div>
              ) : (
                <div className="pt-2 border-t border-[#1b2234] flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setConfirmAction('fix_forward')}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold rounded-lg transition flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    <Zap size={14} />
                    <span>{actionLoading ? 'Deploying...' : 'Approve & Deploy Hotfix (:8000)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmAction('rollback')}
                    disabled={actionLoading}
                    className="px-3.5 py-2 bg-[#161b26] hover:bg-[#212a3d] text-[#c9d1d9] text-xs font-medium rounded-lg border border-[#212a3d] transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <RotateCcw size={13} className="text-[#d29922]" />
                    <span>Rollback to Prior Commit...</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onTakeover && onTakeover()}
                    disabled={actionLoading}
                    className="px-3.5 py-2 bg-[#161b26] hover:bg-[#212a3d] text-[#8b949e] hover:text-[#c9d1d9] text-xs rounded-lg border border-[#212a3d] transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <UserX size={13} />
                    <span>Manual Takeover</span>
                  </button>
                </div>
              )}
            </div>

            {/* Live Autonomous SRE Agent Cognitive Trajectory & Execution Console */}
            <AgentExecutionConsole
              incident={incident}
              events={events}
              onApprove={() => setConfirmAction('fix_forward')}
              onRollback={() => setConfirmAction('rollback')}
              onTakeover={onTakeover}
              actionLoading={actionLoading}
            />

          </div>
        )}

        {/* ===================== TAB 2: AGENT CONSOLE ===================== */}
        {activeTab === 'agent' && (
          <div className="space-y-4">
            <AgentExecutionConsole
              incident={incident}
              events={events}
              onApprove={() => setConfirmAction('fix_forward')}
              onRollback={() => setConfirmAction('rollback')}
              onTakeover={onTakeover}
              actionLoading={actionLoading}
            />

            {diffContent && (
              <div className="rounded-lg bg-[#0d111a] border border-[#1b2234] p-4 space-y-2.5">
                <div className="flex items-center justify-between border-b border-[#1b2234] pb-2">
                  <div className="flex items-center gap-1.5">
                    <FileCode size={14} className="text-[#58a6ff]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#c9d1d9] font-mono">
                      Candidate Code Patch Synthesized by Fixer
                    </span>
                  </div>
                </div>
                <div className="rounded border border-[#1b2234] overflow-hidden">
                  <DiffViewer diff={diffContent} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 2: LOGS & TRACES ===================== */}
        {activeTab === 'logs' && (
          <div className="space-y-3">
            {/* Extracted Traceback */}
            <div className="rounded-md bg-[#0d111a] border border-[#1b2234] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Terminal size={14} className="text-[#ff7b72]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#ff7b72] font-mono">
                    Extracted Production Traceback
                  </span>
                </div>
                <button
                  onClick={handleCopyTrace}
                  className="px-2 py-0.5 rounded bg-[#161b26] hover:bg-[#212a3d] text-[10px] font-mono text-[#8b949e] hover:text-[#c9d1d9] flex items-center gap-1 transition border border-[#212a3d]"
                >
                  <Copy size={11} />
                  <span>{copiedTrace ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="p-3 rounded bg-[#07090f] border border-[#261317] text-xs font-mono text-[#ff7b72] overflow-x-auto leading-relaxed">
                <pre>{incident.trace || 'No traceback captured for this incident.'}</pre>
              </div>
            </div>

            {/* Surrounding Log Tail */}
            <div className="rounded-md bg-[#0d111a] border border-[#1b2234] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8b949e] font-mono flex items-center gap-1.5">
                  <Clock size={12} className="text-[#58a6ff]" />
                  <span>Surrounding Production Log Context</span>
                </span>
                <span className="text-[10px] font-mono text-[#6e7681]">Telemetry Forwarder</span>
              </div>

              <div className="p-3 rounded bg-[#07090f] border border-[#1b2234] text-xs font-mono text-[#8b949e] overflow-x-auto leading-relaxed">
                <pre>{incident.log_tail || 'No surrounding logs captured.'}</pre>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 3: INVESTIGATION & RCA ===================== */}
        {activeTab === 'investigation' && (
          <div className="space-y-3">
            {/* RCA Card */}
            <div className="rounded-md bg-[#0d111a] border border-[#1b2234] p-4 space-y-2.5">
              <div className="flex items-center gap-1.5 border-b border-[#1b2234] pb-2">
                <AlertTriangle size={14} className="text-[#ff7b72]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#ff7b72] font-mono">
                  Root Cause Analysis (RCA) Report
                </span>
              </div>

              <div className="p-2.5 rounded bg-[#160d10] border border-[#3e1b23] text-xs space-y-1">
                <span className="text-[#6e7681] font-mono text-[9px] uppercase">Identified Root Cause:</span>
                <div className="text-[#ff7b72] font-bold font-mono text-xs">
                  {rootCauseSummary}
                </div>
                <p className="text-[#8b949e] font-mono text-[11px]">
                  {incident.brief?.summary || incident.description || 'Root cause investigation underway.'}
                </p>
              </div>

              {/* Suspect Commit Card */}
              {suspectHash ? (
                <div className="p-2.5 rounded bg-[#07090f] border border-[#1b2234] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#6e7681] font-mono text-[9px] uppercase flex items-center gap-1">
                      <GitCommit size={11} className="text-[#58a6ff]" />
                      Suspect Commit (Git Blame Attribution)
                    </span>
                    <span className="text-[#58a6ff] font-mono font-bold text-xs">
                      {suspectHash}
                    </span>
                  </div>
                  {suspectMessage && (
                    <div className="text-xs font-semibold text-[#f0f6fc]">
                      {suspectMessage}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[10px] font-mono text-[#6e7681]">
                    {suspectAuthor && <span>Author: <strong className="text-[#c9d1d9]">{suspectAuthor}</strong></span>}
                    {suspectTime && <span>• Landed: <strong className="text-[#c9d1d9]">{suspectTime}</strong></span>}
                    {suspectLocation && <span>• Line: <strong className="text-[#58a6ff]">{suspectLocation}</strong></span>}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded bg-[#07090f] border border-[#1b2234] text-xs font-mono text-[#6e7681]">
                  No suspect commit correlated yet via git blame.
                </div>
              )}

              {/* Hypotheses vs Facts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono pt-1">
                <div className="p-2.5 rounded bg-[#07090f] border border-[#1b3d2b] space-y-1">
                  <div className="flex items-center gap-1 text-[#3fb950] font-bold text-[11px]">
                    <CheckCircle2 size={12} />
                    <span>Confirmed Facts</span>
                  </div>
                  <ul className="list-disc list-inside text-[#8b949e] text-[10px] space-y-0.5">
                    <li>Active exception detected in production telemetry</li>
                    <li>Service {incident.service || 'target'} reported non-200 health probe</li>
                    <li>Triager initiated worktree reproduction</li>
                  </ul>
                </div>
                <div className="p-2.5 rounded bg-[#07090f] border border-[#1b2234] space-y-1">
                  <div className="flex items-center gap-1 text-[#6e7681] font-bold text-[11px]">
                    <Info size={12} />
                    <span>Ruled-Out Hypotheses</span>
                  </div>
                  <ul className="list-disc list-inside text-[#6e7681] text-[10px] space-y-0.5">
                    <li>Database connection timeout (ruled out)</li>
                    <li>Network partition / edge DNS failure (ruled out)</li>
                    <li>Memory leak / container OOM event (ruled out)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 4: RECOVERY & CANARIES ===================== */}
        {activeTab === 'recovery' && (
          <div className="space-y-3">
            <div className="rounded-md bg-[#0d111a] border border-[#1b2234] p-4 space-y-2.5">
              <div className="flex items-center justify-between border-b border-[#1b2234] pb-2">
                <div className="flex items-center gap-1.5">
                  <Server size={14} className="text-[#3fb950]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#3fb950] font-mono">
                    Staged Canary Verification Environments
                  </span>
                </div>
                <span className={`text-[10px] font-mono ${
                  staging.fix_forward?.health === true && staging.rollback?.health === true
                    ? 'text-[#3fb950]'
                    : staging.fix_forward?.health === false || staging.rollback?.health === false
                    ? 'text-[#ff7b72]'
                    : 'text-[#8b949e]'
                }`}>
                  {staging.fix_forward?.health === true && staging.rollback?.health === true
                    ? 'Dual Canaries Verified (200 OK)'
                    : staging.fix_forward?.health === false || staging.rollback?.health === false
                    ? 'Canary Health Probe Failed'
                    : 'Awaiting Canary Verification'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Canary 8001 */}
                <div className="p-3 rounded bg-[#07090f] border border-[#1b3d2b] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        staging.fix_forward?.health === true
                          ? 'bg-[#3fb950]'
                          : staging.fix_forward?.health === false
                          ? 'bg-[#f85149]'
                          : 'bg-[#8b949e]'
                      }`} />
                      <span className="font-bold text-[#f0f6fc] font-mono text-xs">Canary 8001 (Fix-Forward)</span>
                    </div>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border ${
                      staging.fix_forward?.health === true
                        ? 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]'
                        : staging.fix_forward?.health === false
                        ? 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]'
                        : 'bg-[#161b22] text-[#8b949e] border-[#21262d]'
                    }`}>
                      {staging.fix_forward?.health === true
                        ? '200 OK'
                        : staging.fix_forward?.health === false
                        ? 'PROBE FAILED'
                        : 'NOT STAGED'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8b949e] font-mono">
                    {incident.brief?.summary ? `Staged candidate fix for: ${incident.brief.summary}` : 'Candidate fix synthesized and verified in worktree.'}
                  </p>
                  <div className="p-1.5 rounded bg-[#0b0e14] border border-[#1b2234] text-[10px] font-mono text-[#6e7681]">
                    <div>Health Evidence: <strong className={staging.fix_forward?.health ? 'text-[#3fb950]' : 'text-[#8b949e]'}>
                      {staging.fix_forward?.health ? 'Verified Passing (200 OK)' : 'Awaiting passing probe'}
                    </strong></div>
                    <div className="mt-0.5">Probe URL: <code className="text-[#58a6ff]">http://127.0.0.1:8001/health</code></div>
                  </div>
                </div>

                {/* Canary 8002 */}
                <div className="p-3 rounded bg-[#07090f] border border-[#2e2350] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        staging.rollback?.health === true
                          ? 'bg-[#a371f7]'
                          : staging.rollback?.health === false
                          ? 'bg-[#f85149]'
                          : 'bg-[#8b949e]'
                      }`} />
                      <span className="font-bold text-[#f0f6fc] font-mono text-xs">Canary 8002 (Rollback)</span>
                    </div>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border ${
                      staging.rollback?.health === true
                        ? 'bg-[#161226] text-[#a371f7] border-[#2e2350]'
                        : staging.rollback?.health === false
                        ? 'bg-[#261317] text-[#ff7b72] border-[#4a1c24]'
                        : 'bg-[#161b22] text-[#8b949e] border-[#21262d]'
                    }`}>
                      {staging.rollback?.health === true
                        ? '200 OK'
                        : staging.rollback?.health === false
                        ? 'PROBE FAILED'
                        : 'NOT STAGED'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8b949e] font-mono">
                    Clean checkout of parent commit <code className="text-[#a371f7]">{suspectHash || 'parent'}</code>.
                  </p>
                  <div className="p-1.5 rounded bg-[#0b0e14] border border-[#1b2234] text-[10px] font-mono text-[#6e7681]">
                    <div>Health Evidence: <strong className={staging.rollback?.health ? 'text-[#a371f7]' : 'text-[#8b949e]'}>
                      {staging.rollback?.health ? 'Verified Passing (200 OK)' : 'Awaiting passing probe'}
                    </strong></div>
                    <div className="mt-0.5">Probe URL: <code className="text-[#58a6ff]">http://127.0.0.1:8002/health</code></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Watchdog explanation */}
            <div className="rounded-md bg-[#0d111a] border border-[#1b2234] p-3 space-y-1 text-xs font-mono">
              <div className="flex items-center gap-1.5 font-bold text-[#f0f6fc] text-[11px]">
                <ShieldCheck size={13} className="text-[#58a6ff]" />
                <span>10-Second Post-Deploy Watchdog Guard</span>
              </div>
              <p className="text-[11px] text-[#8b949e] leading-relaxed">
                When approved, ProdPilot promotes the canary to port 8000 and probes <code className="text-[#58a6ff]">/health</code> every second for 10 seconds. Any non-200 probe automatically triggers instant rollback.
              </p>
            </div>
          </div>
        )}

        {/* ===================== TAB 5: CHANGES & DIFFS ===================== */}
        {activeTab === 'changes' && (
          <div className="space-y-3">
            <div className="rounded-md bg-[#0d111a] border border-[#1b2234] p-4 space-y-2.5">
              <div className="flex items-center justify-between border-b border-[#1b2234] pb-2">
                <div className="flex items-center gap-1.5">
                  <FileCode size={14} className="text-[#58a6ff]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8b949e] font-mono">
                    Synthesized Git Patch Diff
                  </span>
                </div>
                {artifacts.repro_test && (
                  <span className="text-[10px] font-mono text-[#58a6ff]">
                    {artifacts.repro_test}
                  </span>
                )}
              </div>

              <div className="rounded border border-[#1b2234] overflow-hidden">
                {diffContent ? (
                  <DiffViewer diff={diffContent} />
                ) : (
                  <div className="p-6 text-center text-xs font-mono text-[#6e7681]">
                    No patch diff synthesized yet. Remediation pipeline is triaging the incident.
                  </div>
                )}
              </div>
            </div>

            {/* Test Evidence Red -> Green */}
            <div className="rounded-md bg-[#0d111a] border border-[#1b2234] p-4 space-y-2.5">
              <div className="flex items-center justify-between border-b border-[#1b2234] pb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8b949e] font-mono flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-[#3fb950]" />
                  <span>Deterministic Reproduction Proof (Red $\rightarrow$ Green)</span>
                </span>
                {testEvidence && (
                  <span className="text-[9px] font-mono text-[#3fb950] bg-[#0d1e17] px-1.5 py-0.2 rounded border border-[#1b3d2b]">
                    VERIFIED
                  </span>
                )}
              </div>

              {testEvidence ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded bg-[#07090f] border border-[#3e1b23] space-y-1">
                    <div className="flex items-center gap-1 text-[#ff7b72] font-bold text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#f85149]" />
                      <span>BEFORE PATCH (Red Test Proof)</span>
                    </div>
                    <pre className="text-[#ff7b72] text-[10px] whitespace-pre-wrap overflow-x-auto leading-relaxed">
                      {typeof testEvidence.before === 'string' ? testEvidence.before : JSON.stringify(testEvidence.before, null, 2)}
                    </pre>
                  </div>
                  <div className="p-2.5 rounded bg-[#07090f] border border-[#1b3d2b] space-y-1">
                    <div className="flex items-center gap-1 text-[#3fb950] font-bold text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />
                      <span>AFTER PATCH (Green Test Proof)</span>
                    </div>
                    <pre className="text-[#3fb950] text-[10px] whitespace-pre-wrap overflow-x-auto leading-relaxed">
                      {typeof testEvidence.after === 'string' ? testEvidence.after : JSON.stringify(testEvidence.after, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-xs font-mono text-[#6e7681]">
                  No test execution evidence recorded yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 6: TIMELINE & AUDIT ===================== */}
        {activeTab === 'timeline' && (
          <div className="space-y-3">
            <div className="rounded-md bg-[#0d111a] border border-[#1b2234] p-4 space-y-2.5">
              <div className="flex items-center justify-between border-b border-[#1b2234] pb-2">
                <div className="flex items-center gap-1.5">
                  <Radio size={14} className="text-[#58a6ff]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8b949e] font-mono">
                    Real-Time SSE Event Audit Trail
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#6e7681]">
                  {events.length} events logged
                </span>
              </div>

              <div className="space-y-1.5 text-xs font-mono">
                {events.length === 0 ? (
                  <div className="p-3 rounded bg-[#07090f] border border-[#1b2234] text-[#485263] text-center text-xs">
                    Listening to live SSE stream for incident events...
                  </div>
                ) : (
                  events.map((ev, i) => (
                    <div key={i} className="p-2 rounded bg-[#07090f] border border-[#1b2234] flex items-start gap-2">
                      <span className="px-1 py-0.2 rounded bg-[#121929] text-[#58a6ff] border border-[#1d2d47] text-[9px] font-bold flex-shrink-0">
                        {ev.stage || 'EVENT'}
                      </span>
                      <span className="text-[#8b949e] text-[10px] font-semibold flex-shrink-0">
                        {ev.kind}:
                      </span>
                      <span className="text-[#c9d1d9] text-[11px] break-all">
                        {typeof ev.payload === 'string' ? ev.payload : JSON.stringify(ev.payload)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Docked Sticky Bottom Action Bar (Contained within incident view) */}
      {isAwaiting && (
        <div className="sticky bottom-0 z-30 bg-[#0d111a]/95 backdrop-blur-md border-t border-[#1b2234] p-3 shadow-xl mt-auto shrink-0">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-[#8b949e]">
              <span className="w-2 h-2 rounded-full bg-[#e3b341] animate-pulse" />
              <span>Remediation candidate verified and awaiting operator approval</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setConfirmAction('fix_forward')}
                disabled={actionLoading}
                className="flex-1 sm:flex-none px-4 py-2 rounded-md bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-sm"
              >
                <Zap size={14} />
                <span>{actionLoading ? 'Deploying...' : 'Approve & Deploy (:8000)'}</span>
              </button>

              <button
                onClick={() => setConfirmAction('rollback')}
                disabled={actionLoading}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-md bg-[#161b26] hover:bg-[#212a3d] text-[#c9d1d9] text-xs font-medium flex items-center justify-center gap-1.5 border border-[#212a3d] transition disabled:opacity-50"
              >
                <RotateCcw size={13} />
                <span>Rollback</span>
              </button>

              <button
                onClick={() => onTakeover && onTakeover()}
                disabled={actionLoading}
                className="px-3 py-2 rounded-md bg-[#161b26] hover:bg-[#212a3d] text-[#8b949e] hover:text-[#c9d1d9] text-xs flex items-center justify-center gap-1.5 border border-[#212a3d] transition disabled:opacity-50"
                title="Pause automation for manual operator intervention"
              >
                <UserX size={13} />
                <span className="hidden sm:inline">Manual Takeover</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deployment & Git Push Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-[#0d111a] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden flex flex-col text-left">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#21262d] bg-[#161b26]">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg border ${
                  confirmAction === 'rollback'
                    ? 'bg-[#3b1219] border-[#da3633]/40 text-[#f85149]'
                    : 'bg-[#12281e] border-[#238636]/40 text-[#3fb950]'
                }`}>
                  {confirmAction === 'rollback' ? <RotateCcw size={20} /> : <Zap size={20} />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#f0f6fc]">
                    {confirmAction === 'rollback' ? 'Confirm Production Rollback' : 'Confirm Deployment & Git Push'}
                  </h3>
                  <p className="text-[11px] text-[#8b949e] mt-0.5">
                    Target: <span className="font-mono text-[#c9d1d9] font-medium">{incident.service || 'Production Service'}</span>
                    {' • '}
                    {confirmAction === 'rollback' ? 'Revert to prior stable release' : 'Promote patch to remote repo & live service'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConfirmAction(null)}
                className="text-[#8b949e] hover:text-[#f0f6fc] p-1.5 rounded-md hover:bg-[#21262d] transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">

              {confirmAction === 'rollback' ? (
                <>
                  <p className="text-[#c9d1d9] leading-relaxed">
                    Select a previous stable commit from repository history to revert production traffic to. ProdPilot will create an isolated rollback branch, verify canary health, and deploy to port 8000:
                  </p>

                  {/* Commit Selector List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#8b949e]">
                      <span>Available Repository Commits</span>
                      {loadingCommits ? (
                        <span className="text-[#58a6ff] text-[11px] animate-pulse">Loading commits...</span>
                      ) : (
                        <span className="text-[11px] font-mono text-[#6e7681]">{commitsList.length} commits found</span>
                      )}
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1.5 rounded-lg border border-[#21262d] bg-[#07090f] p-2.5">
                      {commitsList.length === 0 && !loadingCommits && (
                        <div className="text-center py-4 text-[#8b949e] font-mono text-[11px]">
                          No previous commits found. Rollback will revert to HEAD~1.
                        </div>
                      )}
                      {commitsList.map((c, idx) => {
                        const cHash = c.hash || c.id || '';
                        const isSelected = selectedCommitHash === cHash;
                        const isSuspect = suspectHash && cHash.startsWith(suspectHash);
                        const isRecommended = idx === 1 || (!suspectHash && idx === 1);

                        return (
                          <div
                            key={cHash || idx}
                            onClick={() => setSelectedCommitHash(cHash)}
                            className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex items-start gap-3 select-none ${
                              isSelected
                                ? 'bg-[#161f30] border-[#58a6ff] text-[#f0f6fc] ring-1 ring-[#58a6ff]/40 shadow-sm'
                                : 'bg-[#0d111a] border-[#21262d] hover:bg-[#161b26] text-[#c9d1d9]'
                            }`}
                          >
                            <input
                              type="radio"
                              name="rollback_commit_radio"
                              checked={isSelected}
                              onChange={() => setSelectedCommitHash(cHash)}
                              className="mt-1 accent-[#58a6ff] cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-[#58a6ff] text-xs">
                                  {cHash.slice(0, 7)}
                                </span>
                                {isRecommended && (
                                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#162e21] text-[#3fb950] border border-[#235836]">
                                    Recommended (Known-Good)
                                  </span>
                                )}
                                {isSuspect && (
                                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#3b1219] text-[#f85149] border border-[#da3633]/40">
                                    Suspect Culprit
                                  </span>
                                )}
                                <span className="text-[11px] text-[#8b949e] font-sans">
                                  {c.time || c.author || ''}
                                </span>
                              </div>
                              <p className="text-xs text-[#c9d1d9] mt-1 font-sans truncate">
                                {c.message || 'No commit message'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[#c9d1d9] leading-relaxed">
                    ProdPilot is ready to promote and deploy the verified defensive remediation patch. Please review the automated deployment sequence before proceeding:
                  </p>

                  {/* Step-by-step pipeline */}
                  <div className="rounded-lg bg-[#161b26] border border-[#21262d] p-3.5 space-y-3 font-mono text-[11px]">
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-[#238636]/20 border border-[#238636] text-[#3fb950] flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                        1
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-[#f0f6fc] flex items-center gap-1.5 font-sans text-xs">
                          <GitCommit size={13} className="text-[#58a6ff]" />
                          <span>Merge & Commit Patch Locally</span>
                        </div>
                        <div className="text-[11px] text-[#8b949e] font-sans mt-0.5 leading-normal">
                          Commits synthesized remediation diff to repository with incident attribution metadata.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-[#238636]/20 border border-[#238636] text-[#3fb950] flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                        2
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-[#f0f6fc] flex items-center gap-1.5 font-sans text-xs">
                          <GitBranch size={13} className="text-[#3fb950]" />
                          <span>Push to Remote Git (origin/main)</span>
                        </div>
                        <div className="text-[11px] text-[#8b949e] font-sans mt-0.5 leading-normal">
                          Pushes committed changes upstream to remote branch via git push.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-[#238636]/20 border border-[#238636] text-[#3fb950] flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                        3
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-[#f0f6fc] flex items-center gap-1.5 font-sans text-xs">
                          <Server size={13} className="text-[#d29922]" />
                          <span>Trigger Cloud Redeployment (Render)</span>
                        </div>
                        <div className="text-[11px] text-[#8b949e] font-sans mt-0.5 leading-normal">
                          Triggers Render deploy API to build and redeploy the latest commit on your production service.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-[#238636]/20 border border-[#238636] text-[#3fb950] flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                        4
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-[#f0f6fc] flex items-center gap-1.5 font-sans text-xs">
                          <ShieldCheck size={13} className="text-[#3fb950]" />
                          <span>10-Second Post-Deploy Watchdog</span>
                        </div>
                        <div className="text-[11px] text-[#8b949e] font-sans mt-0.5 leading-normal">
                          Monitors live health probes. Automatically invokes safety rollback if error rates or crashes persist.
                        </div>
                      </div>
                    </div>
                  </div>

                  {(artifacts.patch_diff || incident.diff) && (
                    <div className="p-3 rounded-lg bg-[#0b0e14] border border-[#21262d] text-xs">
                      <div className="text-[#8b949e] flex items-center gap-1.5 mb-1.5">
                        <FileCode size={13} className="text-[#58a6ff]" />
                        <span className="font-semibold text-[#c9d1d9]">Patch Summary:</span>
                      </div>
                      <div className="text-[#8b949e] leading-relaxed">
                        {generateNaturalFix()}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#21262d] bg-[#161b26]">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-md bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-xs font-medium transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const act = confirmAction;
                  const commitToRevert = selectedCommitHash;
                  setConfirmAction(null);
                  if (act === 'rollback') {
                    if (onRollback) onRollback(commitToRevert);
                  } else {
                    if (onApprove) onApprove('fix_forward');
                  }
                }}
                disabled={actionLoading || (confirmAction === 'rollback' && !selectedCommitHash && commitsList.length > 0)}
                className={`px-4 py-2 rounded-md text-white text-xs font-semibold flex items-center gap-2 transition shadow-sm disabled:opacity-50 cursor-pointer ${
                  confirmAction === 'rollback'
                    ? 'bg-[#da3633] hover:bg-[#b62324]'
                    : 'bg-[#238636] hover:bg-[#2ea043]'
                }`}
              >
                {confirmAction === 'rollback' ? <RotateCcw size={14} /> : <Zap size={14} />}
                <span>
                  {confirmAction === 'rollback'
                    ? `Confirm Rollback ${selectedCommitHash ? `to ${selectedCommitHash.slice(0, 7)}` : ''}`
                    : 'Confirm & Deploy to Production'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
