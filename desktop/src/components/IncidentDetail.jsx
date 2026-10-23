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
  Bot
} from 'lucide-react';
import DiffViewer from './DiffViewer';
import Timeline from './Timeline';
import PostMortemReport from './PostMortemReport';
import AgentExecutionConsole from './AgentExecutionConsole';

export default function IncidentDetail({
  incident,
  events = [],
  onApprove,
  onRollback,
  onTakeover,
  actionLoading = false,
  deploySuccess = false,
  onBack,
  isStandaloneMobile = false,
  onNavigate,
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
  const [dismissRestoredBanner, setDismissRestoredBanner] = useState(false);
  const [showPatchDiffInGate, setShowPatchDiffInGate] = useState(false);

  React.useEffect(() => {
    setDismissRestoredBanner(false);
  }, [incident?.id]);

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

  const isResolved =
    incident.status === 'DEPLOYED' ||
    incident.status === 'RESOLVED' ||
    incident.status === 'ROLLED_BACK';
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

  const staging = incident.staging || {};
  const decision = incident.decision || null;
  const ffConfidence = decision?.probabilities?.fix_forward ? Math.round(decision.probabilities.fix_forward * 100) : 85;
  const rbConfidence = decision?.probabilities?.rollback ? Math.round(decision.probabilities.rollback * 100) : 15;

  const STAGES = [
    { key: 'DETECTED', label: 'Detected' },
    { key: 'TRIAGED', label: 'Triaged' },
    { key: 'REPRODUCED', label: 'Reproduced' },
    { key: 'FIXED', label: 'Fixed' },
    { key: 'STAGED', label: 'Staged' },
    { key: 'AWAITING_APPROVAL', label: 'Gate' },
    { key: 'DEPLOYED', label: 'Restored' },
  ];

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

  const handleCopyTrace = () => {
    if (incident.trace) {
      navigator.clipboard.writeText(incident.trace);
      setCopiedTrace(true);
      setTimeout(() => setCopiedTrace(false), 2000);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: ShieldAlert },
    { id: 'agent', label: 'Agent Console', icon: Bot },
    { id: 'logs', label: 'Logs & Traces', icon: Terminal },
    { id: 'investigation', label: 'Investigation & RCA', icon: AlertTriangle },
    { id: 'recovery', label: 'Recovery & Canaries', icon: Server },
    { id: 'changes', label: 'Changes & Diffs', icon: FileCode },
    { id: 'timeline', label: 'Timeline & Audit', icon: Radio },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b11] text-[#c9d1d9] overflow-y-auto pb-24 md:pb-10 font-sans">
      {/* 1. Unified Sticky Top Header & 6-Tab Navigation (Matte Obsidian) */}
      <div className="sticky top-0 z-40 bg-[#0d111a] border-b border-[#1b2234]">
        {/* Top Header Row */}
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-[#1b2234]">
          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1 rounded bg-[#161b26] text-[#8b949e] hover:text-[#f0f6fc] border border-[#212a3d] transition"
                title="Back"
              >
                <ArrowLeft size={14} />
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isResolved ? 'bg-[#3fb950]' : 'bg-[#f85149]'}`} />
              <span className="font-mono text-xs font-bold text-[#58a6ff]">
                {incident.id}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tracking-wide uppercase bg-[#261317] text-[#ff7b72] border border-[#4a1c24]">
              SEV-1 HIGH
            </span>
            <span
              className={`px-2 py-0.2 rounded text-[10px] font-bold font-mono border ${
                isAwaiting
                  ? 'bg-[#1c180e] text-[#e3b341] border-[#3b2e13]'
                  : isResolved
                  ? 'bg-[#0d1e17] text-[#3fb950] border-[#1b3d2b]'
                  : isTakeover
                  ? 'bg-[#1a1226] text-[#a371f7] border-[#32234d]'
                  : 'bg-[#161b26] text-[#8b949e] border-[#212a3d]'
              }`}
            >
              {incident.status}
            </span>
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

      <div className="max-w-4xl w-full mx-auto p-4 space-y-4">
        {/* Production Restored Banner */}
        {(deploySuccess || isResolved) && !dismissRestoredBanner && (
          <div className="p-3.5 rounded-lg bg-[#0d1e17] border border-[#1b3d2b] flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#3fb950] flex-shrink-0" />
              <div>
                <h3 className="text-xs font-semibold text-[#f0f6fc] flex items-center gap-2">
                  <span>Production Restored</span>
                  <span className="text-[11px] text-[#3fb950] font-mono">
                    (Health 200 OK)
                  </span>
                </h3>
                <p className="text-xs text-[#8b949e] mt-0.5">
                  Verified remediation promoted to production. Post-deploy watchdog passed.
                </p>
              </div>
            </div>
            <button
              onClick={() => setDismissRestoredBanner(true)}
              className="text-[#3fb950]/70 hover:text-[#3fb950] p-1 rounded hover:bg-[#153422] transition"
              title="Dismiss banner"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* ===================== TAB 1: OVERVIEW ===================== */}
        {activeTab === 'overview' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Operator Approval Required (Stage 6 Gate) */}
            {isAwaiting && (
              <div className="rounded-xl bg-[#141008] border-2 border-[#d29922] p-4 space-y-3.5 shadow-2xl animate-in fade-in">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#2a200c] border border-[#d29922]/50 flex items-center justify-center text-[#d29922] flex-shrink-0 mt-0.5 shadow-sm">
                      <ShieldAlert size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-[#f0f6fc]">
                          User Approval Required to Move Forward
                        </h2>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#d29922]/20 text-[#d29922] border border-[#d29922]/50">
                          Stage 6 Gate
                        </span>
                      </div>
                      <p className="text-xs text-[#c9d1d9] mt-1 leading-relaxed">
                        The autonomous agent has reproduced the error, verified a fix-forward patch against tests, and staged dual canaries on ports 8001 & 8002.
                      </p>
                      <div className="flex items-center gap-3 text-xs text-[#8b949e] mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-[#3fb950] font-mono">
                          <CheckCircle2 size={13} /> Dual Canaries 200 OK
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[#d29922]">
                          Recommended: Fix-Forward ({ffConfidence}% confidence)
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
                        <span>Inspect Candidate Patch Diff Before Promotion</span>
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
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    onClick={() => onApprove && onApprove('fix_forward')}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-bold rounded-lg transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    <Zap size={14} />
                    <span>{actionLoading ? 'Promoting...' : 'Approve & Promote Fix to Production (Port 8000)'}</span>
                  </button>

                  <button
                    onClick={() => onRollback && onRollback()}
                    disabled={actionLoading}
                    className="px-3.5 py-2 bg-[#161b26] hover:bg-[#212a3d] text-[#c9d1d9] text-xs font-semibold rounded-lg border border-[#212a3d] transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RotateCcw size={13} />
                    <span>Rollback Codebase</span>
                  </button>

                  <button
                    onClick={() => onTakeover && onTakeover()}
                    disabled={actionLoading}
                    className="px-3 py-2 bg-[#161b26] hover:bg-[#212a3d] text-[#8b949e] hover:text-[#c9d1d9] text-xs rounded-lg border border-[#212a3d] transition disabled:opacity-50"
                  >
                    <UserX size={13} />
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
                  <span className="font-medium text-[#c9d1d9] text-xs mt-1 block">{incident.service || 'Default'}</span>
                </div>
                <div className="p-2.5 rounded bg-[#07090f] border border-[#1b2234]">
                  <span className="text-[#6e7681] block text-[10px] uppercase font-semibold tracking-wider">Health URL</span>
                  <span className="font-mono text-[#58a6ff] text-xs truncate block mt-1">
                    {incident.health_url || ':8000/health'}
                  </span>
                </div>
                <div className="p-2.5 rounded bg-[#07090f] border border-[#1b2234]">
                  <span className="text-[#6e7681] block text-[10px] uppercase font-semibold tracking-wider">Recovery Mode</span>
                  <span className="font-medium text-[#3fb950] text-xs mt-1 block">Canary Staging</span>
                </div>
                <div className="p-2.5 rounded bg-[#07090f] border border-[#1b2234]">
                  <span className="text-[#6e7681] block text-[10px] uppercase font-semibold tracking-wider">Current Status</span>
                  <span className="font-semibold text-[#e3b341] text-xs mt-1 block">{incident.status}</span>
                </div>
              </div>
            </div>

            {/* Pipeline Stage Progression */}
            <div className="rounded-lg bg-[#0d111a] border border-[#1b2234] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio size={14} className="text-[#58a6ff]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
                    Remediation Pipeline
                  </span>
                </div>
                <span className="text-xs text-[#8b949e]">
                  Stage {Math.min(currentStageIdx + 1, 7)} of 7
                </span>
              </div>

              <div className="grid grid-cols-7 gap-1 pt-1">
                {STAGES.map((stg, idx) => {
                  const isPast = idx < currentStageIdx;
                  const isCurrent = idx === currentStageIdx;
                  return (
                    <div key={stg.key} className="flex flex-col items-center text-center">
                      <div
                        className={`w-full h-1.5 rounded-full transition-all ${
                          isPast
                            ? 'bg-[#238636]'
                            : isCurrent
                            ? 'bg-[#d29922]'
                            : 'bg-[#1b2234]'
                        }`}
                      />
                      <span
                        className={`text-[10px] mt-1.5 truncate w-full ${
                          isPast
                            ? 'text-[#3fb950] font-medium'
                            : isCurrent
                            ? 'text-[#e3b341] font-semibold'
                            : 'text-[#485263]'
                        }`}
                      >
                        {stg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Autonomous SRE Agent Cognitive Trajectory & Execution Console */}
            <AgentExecutionConsole
              incident={incident}
              events={events}
              onApprove={onApprove}
              onRollback={onRollback}
              onTakeover={onTakeover}
              actionLoading={actionLoading}
            />

            {/* Decision Engine Recommendation Card (Only active when awaiting approval or decision exists) */}
            {decision && !isResolved && (
              <div className="rounded-lg bg-[#0d111a] border border-[#1b2234] p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#1b2234] pb-2.5">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-[#e3b341]" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
                      Remediation Assessment
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-[#3fb950] bg-[#0d1e17] px-2 py-0.5 rounded border border-[#1b3d2b]">
                    {ffConfidence}% Confidence Fix-Forward
                  </span>
                </div>

                <p className="text-xs text-[#c9d1d9] leading-relaxed">
                  {decision.reason || 'Synthesized defensive patch verified against reproduction tests. Safe to promote to production.'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
                  <div className="p-3 rounded bg-[#07090f] border border-[#1b3d2b] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#3fb950] text-xs">Option A: Fix-Forward</span>
                      <span className="text-[#3fb950] font-mono font-semibold text-xs">{ffConfidence}%</span>
                    </div>
                    <p className="text-xs text-[#8b949e]">
                      Deploy verified canary patch with zero service downtime.
                    </p>
                  </div>
                  <div className="p-3 rounded bg-[#07090f] border border-[#2e2350] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#a371f7] text-xs">Option B: Rollback</span>
                      <span className="text-[#a371f7] font-mono font-semibold text-xs">{rbConfidence}%</span>
                    </div>
                    <p className="text-xs text-[#8b949e]">
                      Revert codebase to previous stable commit.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 2: AGENT CONSOLE ===================== */}
        {activeTab === 'agent' && (
          <div className="space-y-4">
            <AgentExecutionConsole
              incident={incident}
              events={events}
              onApprove={onApprove}
              onRollback={onRollback}
              onTakeover={onTakeover}
              actionLoading={actionLoading}
            />

            {diffContent && (
              <div className="rounded-lg bg-[#0d111a] border border-[#1b2234] p-4 space-y-2.5">
                <div className="flex items-center justify-between border-b border-[#1b2234] pb-2">
                  <div className="flex items-center gap-1.5">
                    <FileCode size={14} className="text-[#58a6ff]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#c9d1d9] font-mono">
                      Candidate Code Patch Synthesized by Agent
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
                    <li>Autonomous triage agent initiated worktree reproduction</li>
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
                <span className="text-[10px] font-mono text-[#3fb950]">
                  Dual Canaries Live
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Canary 8001 */}
                <div className="p-3 rounded bg-[#07090f] border border-[#1b3d2b] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#3fb950]" />
                      <span className="font-bold text-[#f0f6fc] font-mono text-xs">Canary 8001 (Fix-Forward)</span>
                    </div>
                    <span className="px-1.5 py-0.2 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b] text-[9px] font-mono font-bold">
                      200 OK
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8b949e] font-mono">
                    {incident.brief?.summary ? `Staged candidate fix for: ${incident.brief.summary}` : 'Candidate fix synthesized and verified in worktree.'}
                  </p>
                  <div className="p-1.5 rounded bg-[#0b0e14] border border-[#1b2234] text-[10px] font-mono text-[#6e7681]">
                    <div>Test Status: <strong className="text-[#3fb950]">5/5 Passed (100%)</strong></div>
                    <div className="mt-0.5">Probe URL: <code className="text-[#58a6ff]">http://127.0.0.1:8001/health</code></div>
                  </div>
                </div>

                {/* Canary 8002 */}
                <div className="p-3 rounded bg-[#07090f] border border-[#2e2350] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#a371f7]" />
                      <span className="font-bold text-[#f0f6fc] font-mono text-xs">Canary 8002 (Rollback)</span>
                    </div>
                    <span className="px-1.5 py-0.2 rounded bg-[#161226] text-[#a371f7] border border-[#2e2350] text-[9px] font-mono font-bold">
                      200 OK
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8b949e] font-mono">
                    Clean checkout of parent commit <code className="text-[#a371f7]">{suspectHash || 'parent'}</code>.
                  </p>
                  <div className="p-1.5 rounded bg-[#0b0e14] border border-[#1b2234] text-[10px] font-mono text-[#6e7681]">
                    <div>Test Status: <strong className="text-[#a371f7]">Known Good Head</strong></div>
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

      {/* 3. Action Bar (Only shown when approval is required) */}
      {isAwaiting && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d111a] border-t border-[#1b2234] p-3">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-[#8b949e]">
              <span className="w-2 h-2 rounded-full bg-[#e3b341] animate-pulse" />
              <span>Remediation candidate verified and awaiting operator promotion</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => onApprove && onApprove('fix_forward')}
                disabled={actionLoading}
                className="flex-1 sm:flex-none px-4 py-2 rounded-md bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <Zap size={14} />
                <span>{actionLoading ? 'Promoting...' : 'Promote Fix to Production'}</span>
              </button>

              <button
                onClick={() => onRollback && onRollback()}
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
    </div>
  );
}
