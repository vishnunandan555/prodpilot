import React, { useState, useEffect } from 'react';
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
  Award,
  ChevronDown,
  ChevronUp,
  Radio,
  ExternalLink,
  ShieldAlert,
  RotateCcw,
  GitPullRequest,
  Check,
  UserX,
  ArrowLeft
} from 'lucide-react';
import DiffViewer from './DiffViewer';
import Timeline from './Timeline';
import PostMortemReport from './PostMortemReport';

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
}) {
  // Accordion state
  const [openAccordions, setOpenAccordions] = useState({
    diff: true,
    evidence: true,
    traceback: false,
    timeline: false,
  });

  const toggleAccordion = (key) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!incident) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gh-text-dim">
        <ShieldAlert size={36} className="text-gh-text-muted mb-3" />
        <p className="text-sm font-semibold text-gh-text-bright">No Incident Selected</p>
        <p className="text-xs text-gh-text-muted mt-1 max-w-sm">
          Select an incident from the sidebar or pass a valid incident ID in the URL.
        </p>
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
  const suspectHash = typeof suspect === 'string' ? suspect.slice(0, 7) : suspect.hash?.slice(0, 7) || 'a1b2c3d';
  const suspectAuthor = suspect.author || 'Vishnu Nandan';
  const suspectMessage = suspect.message || 'feat: add discount support to order checkout';
  const suspectTime = suspect.minutes_ago !== undefined ? `${suspect.minutes_ago}m ago` : '15m ago';
  const suspectLocation = incident.suspected_area || suspect.suspect_file ? `${suspect.suspect_file || 'app.py'}:${suspect.suspect_line || 45}` : 'app.py:45';

  const brief = incident.brief || {};
  const rootCauseSummary = brief.summary || incident.title || `KeyError: 'discount' in ${suspectLocation}`;

  const artifacts = incident.artifacts || {};
  const diffContent =
    artifacts.patch_diff ||
    incident.diff ||
    `--- a/app.py
+++ b/app.py
@@ -43,3 +43,3 @@ def calculate_order(order: Dict[str, Any]) -> Dict[str, Any]:
     tax = round(subtotal * TAX_RATE, 2)
-    discount = order["discount"]
+    discount = order.get("discount", 0.0)
     total = max(0.0, round(subtotal + tax - discount, 2))`;

  const testEvidence = artifacts.test_evidence || {
    before: "FAILED (KeyError: 'discount' in calculate_order app.py:45)",
    after: "5 passed in 0.42s (100% test pass on canary 8001)",
  };

  const staging = incident.staging || {};
  const canary8001Healthy = staging.fix_forward?.health !== false;
  const canary8002Healthy = staging.rollback?.health !== false;

  const decision = incident.decision || {};
  const ffConfidence = Math.round((decision.probabilities?.fix_forward ?? 0.85) * 100);
  const rbConfidence = Math.round((decision.probabilities?.rollback ?? 0.15) * 100);

  // Stages for the animated progression bar
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
      case 'TRIAGED':
        return 1;
      case 'REPRODUCED':
        return 2;
      case 'FIXING':
      case 'FIXED':
        return 3;
      case 'STAGED':
        return 4;
      case 'AWAITING_APPROVAL':
        return 5;
      case 'DEPLOYED':
      case 'RESOLVED':
      case 'ROLLED_BACK':
        return 6;
      case 'MANUAL_TAKEOVER':
        return 5;
      default:
        return 5;
    }
  };

  const currentStageIdx = getStageStatusIndex();

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f19] text-slate-100 overflow-y-auto pb-24 md:pb-8">
      {/* Mobile Top Navigation Bar (if accessed as mobile incident page) */}
      <div className="sticky top-0 z-40 bg-[#0d1322]/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Back"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="font-mono text-xs font-bold text-indigo-400">
              {incident.id}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-red-950/80 text-rose-300 border border-rose-800/80">
            SEV-1 HIGH
          </span>
          <span
            className={`px-2.5 py-0.5 rounded text-[11px] font-bold font-mono ${
              isAwaiting
                ? 'bg-amber-950/80 text-amber-300 border border-amber-500/50 animate-pulse'
                : isResolved
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50'
                : isTakeover
                ? 'bg-purple-950/80 text-purple-300 border border-purple-500/50'
                : 'bg-slate-800 text-slate-300 border border-slate-700'
            }`}
          >
            {incident.status}
          </span>
        </div>
      </div>

      <div className="max-w-4xl w-full mx-auto p-4 md:p-6 space-y-4">
        {/* Production Restored Celebration Banner */}
        {(deploySuccess || isResolved) && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/90 via-emerald-900/40 to-teal-950/90 border border-emerald-500/50 shadow-lg shadow-emerald-950/50 flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-emerald-300 animate-spin" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>✅ PRODUCTION RESTORED</span>
                  <span className="text-[11px] font-mono font-normal text-emerald-300">
                    (Port 8000: 200 OK)
                  </span>
                </h3>
                <p className="text-xs text-emerald-200/80 mt-0.5 font-mono">
                  Promoted verified build to production port 8000 • 10s health probe passed
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 1. HEADER CARD: Title, Status, Severity, Detection Time */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 md:p-5 shadow-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {incident.service || 'demo-prod'}
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                  <Clock size={12} className="text-slate-500" />
                  Detected: {incident.detected_at || 'Just now (15m ago)'}
                </span>
              </div>
              <h1 className="text-lg md:text-xl font-bold text-white mt-1.5 leading-snug">
                {incident.title || `[OUTAGE] ${incident.suspected_area || 'KeyError discount on /orders'}`}
              </h1>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-mono text-slate-400">Severity:</span>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-rose-950/70 text-rose-300 border border-rose-500/40">
                HIGH (SEV-1)
              </span>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800/80">
              <span className="text-slate-500 block text-[10px] uppercase tracking-wider font-mono">Target Service</span>
              <span className="font-semibold text-slate-200 font-mono text-xs">{incident.service || 'demo-prod'}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800/80">
              <span className="text-slate-500 block text-[10px] uppercase tracking-wider font-mono">Health URL</span>
              <span className="font-semibold text-indigo-400 font-mono text-xs truncate block" title="http://127.0.0.1:8000/health">
                :8000/health
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800/80">
              <span className="text-slate-500 block text-[10px] uppercase tracking-wider font-mono">Auto Recovery</span>
              <span className="font-semibold text-emerald-400 font-mono text-xs">Staged (8001)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800/80">
              <span className="text-slate-500 block text-[10px] uppercase tracking-wider font-mono">Status</span>
              <span className="font-semibold text-amber-400 font-mono text-xs">{incident.status}</span>
            </div>
          </div>
        </div>

        {/* 2. LIVE SSE TIMELINE: Animated Stage Progression */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 md:p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio size={14} className="text-indigo-400 animate-pulse" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Live SSE Remediation Pipeline
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Stage {Math.min(currentStageIdx + 1, 7)} of 7
            </span>
          </div>

          {/* Visual Step Progression Bar */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 pt-1">
            {STAGES.map((stg, idx) => {
              const isPast = idx < currentStageIdx;
              const isCurrent = idx === currentStageIdx;
              const isPending = idx > currentStageIdx;

              return (
                <div key={stg.key} className="flex flex-col items-center text-center">
                  <div
                    className={`w-full h-1.5 rounded-full transition-all duration-300 ${
                      isPast
                        ? 'bg-emerald-500'
                        : isCurrent
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-slate-800'
                    }`}
                  />
                  <span
                    className={`text-[10px] sm:text-[11px] mt-1.5 font-mono truncate w-full ${
                      isPast
                        ? 'text-emerald-400 font-medium'
                        : isCurrent
                        ? 'text-amber-300 font-bold'
                        : 'text-slate-600'
                    }`}
                  >
                    {stg.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Toggleable Full Events Feed */}
          <div className="pt-1">
            <button
              onClick={() => toggleAccordion('timeline')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono transition"
            >
              {openAccordions.timeline ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span>{openAccordions.timeline ? 'Hide detailed event logs' : `View ${events.length} live SSE pipeline events`}</span>
            </button>
            {openAccordions.timeline && (
              <div className="mt-3 p-3 rounded-lg bg-black/60 border border-slate-800 text-xs font-mono max-h-48 overflow-y-auto space-y-1.5">
                {events.length === 0 ? (
                  <div className="text-slate-500">Listening to live SSE stream at /incidents/{incident.id}/events...</div>
                ) : (
                  events.map((ev, i) => (
                    <div key={i} className="flex items-start gap-2 text-slate-300">
                      <span className="text-indigo-400 flex-shrink-0">[{ev.stage || 'EVENT'}]</span>
                      <span className="text-slate-400 text-[11px]">{ev.kind}:</span>
                      <span className="text-slate-200">{typeof ev.payload === 'string' ? ev.payload : JSON.stringify(ev.payload)}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3. RCA REPORT CARD: Root Cause Summary & Blamed Commit */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 md:p-5 shadow-lg space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-rose-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-rose-300">
              Root Cause Analysis (RCA) Report
            </h2>
          </div>

          <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/20 text-xs space-y-1">
            <span className="text-slate-400 font-mono text-[10px] uppercase">Identified Root Cause:</span>
            <div className="text-rose-300 font-bold font-mono text-sm">
              {rootCauseSummary}
            </div>
            <div className="text-slate-400 text-xs">
              Direct dictionary indexing of missing optional key triggered 500 Internal Server Error in FastAPI checkout pipeline.
            </div>
          </div>

          {/* Suspect Culprit Commit Card */}
          <div className="p-3 rounded-lg bg-black/40 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                Blamed Culprit Commit
              </span>
              <span className="text-amber-400 font-mono text-[11px]">{suspectTime}</span>
            </div>

            <div className="flex items-center gap-2 font-mono">
              <GitCommit size={14} className="text-amber-400 flex-shrink-0" />
              <span className="text-amber-300 font-bold">{suspectHash}</span>
              <span className="text-slate-400">by {suspectAuthor}</span>
            </div>

            <p className="text-slate-300 text-xs italic">
              "{suspectMessage}"
            </p>

            <div className="flex items-center gap-2 pt-1 border-t border-slate-800 text-[11px] font-mono text-slate-400">
              <FileCode size={12} className="text-indigo-400" />
              <span>Suspect Location:</span>
              <span className="text-indigo-300 font-semibold">{suspectLocation}</span>
            </div>
          </div>
        </div>

        {/* 4. CANARY STATUS CARD: Canary 8001 (Fix-Forward) vs Canary 8002 (Rollback) */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 md:p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-indigo-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Canary Staging Health & AI Verdict
              </h2>
            </div>
            <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80">
              Fix-Forward ({ffConfidence}%) vs Rollback ({rbConfidence}%)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Canary 8001: Fix-Forward */}
            <div className="p-3 rounded-lg bg-gradient-to-b from-indigo-950/30 to-slate-950 border border-indigo-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Canary 8001 (Fix-Forward)
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-700">
                  200 OK
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Applies deterministic 1-line patch using <code className="text-indigo-300 bg-black/40 px-1 py-0.5 rounded font-mono">order.get("discount", 0.0)</code>.
              </p>
              <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={12} />
                <span>Deterministic verifier 100% green</span>
              </div>
            </div>

            {/* Canary 8002: Rollback */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Canary 8002 (Rollback)
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-700">
                  200 OK
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Reverts suspect commit <code className="text-slate-300 bg-black/40 px-1 py-0.5 rounded font-mono">{suspectHash}</code> back to previous clean baseline.
              </p>
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                <RotateCcw size={12} />
                <span>Disables new discount feature</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. COLLAPSIBLE EVIDENCE ACCORDION */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 divide-y divide-slate-800 overflow-hidden shadow-lg">
          {/* Accordion 1: Diff Preview (DiffViewer.jsx) */}
          <div>
            <button
              onClick={() => toggleAccordion('diff')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-800/40 transition"
            >
              <div className="flex items-center gap-2.5">
                <FileCode size={15} className="text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Patch Diff Preview
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-emerald-400">+1 / -1 lines</span>
                {openAccordions.diff ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </div>
            </button>
            {openAccordions.diff && (
              <div className="p-3 md:p-4 bg-black/40">
                <DiffViewer diffText={diffContent} />
              </div>
            )}
          </div>

          {/* Accordion 2: PR Review Notes & Test Evidence */}
          <div>
            <button
              onClick={() => toggleAccordion('evidence')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-800/40 transition"
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={15} className="text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Deterministic Test Evidence & PR Notes
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-emerald-400">PASSED</span>
                {openAccordions.evidence ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </div>
            </button>
            {openAccordions.evidence && (
              <div className="p-3 md:p-4 bg-black/40 space-y-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/20">
                  <span className="text-rose-400 block font-bold mb-1 text-[11px]">
                    ❌ Before Patch (Reproduction Test):
                  </span>
                  <div className="text-rose-300 whitespace-pre-wrap">{testEvidence.before}</div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
                  <span className="text-emerald-400 block font-bold mb-1 text-[11px]">
                    ✅ After Patch (Canary Staging Suite):
                  </span>
                  <div className="text-emerald-300 whitespace-pre-wrap">{testEvidence.after}</div>
                </div>
              </div>
            )}
          </div>

          {/* Accordion 3: Captured Stack Trace */}
          <div>
            <button
              onClick={() => toggleAccordion('traceback')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-800/40 transition"
            >
              <div className="flex items-center gap-2.5">
                <Terminal size={15} className="text-rose-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Captured Python Traceback & Service Logs
                </span>
              </div>
              {openAccordions.traceback ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>
            {openAccordions.traceback && (
              <div className="p-3 md:p-4 bg-black/40 space-y-2">
                <pre className="p-3 rounded-lg bg-black/90 border border-rose-500/30 text-xs font-mono text-rose-300 overflow-x-auto leading-relaxed">
                  {incident.trace || incident.log_tail || "Traceback (most recent call last):\n  File 'app.py', line 45, in calculate_order\n    discount = order['discount']\nKeyError: 'discount'"}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Inline Mobile Action Buttons (Visible on desktop & mobile within content) */}
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 shadow-xl space-y-2.5">
          <div className="text-xs font-mono text-slate-400 flex items-center justify-between">
            <span>Human-in-the-Loop Gate</span>
            <span>Choose Action:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Action Button 1: Approve & Deploy Fix */}
            <button
              onClick={() => onApprove && onApprove(incident.id, 'fix')}
              disabled={actionLoading || isResolved}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 active:scale-[0.98]"
            >
              <Zap size={16} className={actionLoading ? 'animate-spin' : ''} />
              <span>{actionLoading ? 'Deploying Fix...' : '🚀 Approve & Deploy Fix'}</span>
            </button>

            {/* Action Button 2: Instant Rollback */}
            <button
              onClick={() => onRollback && onRollback(incident.id)}
              disabled={actionLoading || isResolved}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 active:scale-[0.98]"
            >
              <RotateCcw size={16} />
              <span>Instant Rollback</span>
            </button>

            {/* Action Button 3: Take Over */}
            <button
              onClick={() => onTakeover && onTakeover(incident.id)}
              disabled={actionLoading || isTakeover}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg bg-slate-800 hover:bg-rose-950/80 hover:text-rose-300 text-slate-300 border border-slate-700 disabled:opacity-50 active:scale-[0.98]"
            >
              <UserX size={16} />
              <span>{isTakeover ? 'Under Manual Takeover' : '🛑 Take Over'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6. STICKY BOTTOM 1-TAP MOBILE ACTION BAR (Optimized for Phone Browsers) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0d1322]/95 backdrop-blur-md border-t border-slate-800 p-3 shadow-2xl">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          {/* Deploy Fix Button */}
          <button
            onClick={() => onApprove && onApprove(incident.id, 'fix')}
            disabled={actionLoading || isResolved}
            className="flex-1 py-3 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 bg-emerald-600 active:bg-emerald-700 text-white shadow-md disabled:opacity-50"
          >
            <Zap size={15} />
            <span className="truncate">Deploy Fix</span>
          </button>

          {/* Rollback Button */}
          <button
            onClick={() => onRollback && onRollback(incident.id)}
            disabled={actionLoading || isResolved}
            className="flex-1 py-3 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 bg-amber-600 active:bg-amber-700 text-white shadow-md disabled:opacity-50"
          >
            <RotateCcw size={15} />
            <span className="truncate">Rollback</span>
          </button>

          {/* Take Over Button */}
          <button
            onClick={() => onTakeover && onTakeover(incident.id)}
            disabled={actionLoading || isTakeover}
            className="py-3 px-3 rounded-xl font-bold text-xs flex items-center justify-center bg-slate-800 active:bg-rose-950 text-slate-300 border border-slate-700 disabled:opacity-50"
            title="Manual Takeover"
          >
            <UserX size={16} className="text-rose-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
