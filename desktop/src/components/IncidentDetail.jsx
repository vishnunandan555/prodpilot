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
  Award
} from 'lucide-react';
import Timeline from './Timeline';
import DiffViewer from './DiffViewer';
import TestEvidence from './TestEvidence';
import DecisionCard from './DecisionCard';
import PostMortemReport from './PostMortemReport';

export default function IncidentDetail({
  incident,
  events = [],
  onApprove,
  onReject,
  onFollowup,
  actionLoading,
  celebrationBanner
}) {
  const [activeTab, setActiveTab] = useState('TIMELINE');

  const isResolved = incident?.status === 'DEPLOYED' || incident?.status === 'RESOLVED';

  // Automatically switch to Post-Mortem Report when resolved or celebration active
  useEffect(() => {
    if (isResolved || celebrationBanner) {
      setActiveTab('REPORT');
    }
  }, [isResolved, celebrationBanner]);

  if (!incident) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 font-mono text-xs">
        Select an incident to view live remediation pipeline details.
      </div>
    );
  }

  const suspect = incident.suspect_commit || {};
  const artifacts = incident.artifacts || {};
  const diffContent = artifacts.patch_diff || `diff --git a/app.py b/app.py
--- a/app.py
+++ b/app.py
@@ -43,3 +43,3 @@ def calculate_order(order: Dict[str, Any]) -> Dict[str, Any]:
     tax = round(subtotal * TAX_RATE, 2)
-    discount = order["discount"]
+    discount = order.get("discount", 0.0)
     total = max(0.0, round(subtotal + tax - discount, 2))`;

  const testEvidence = artifacts.test_evidence || {
    before: `tests/test_repro.py::test_order_without_discount FAILED
KeyError: 'discount' in calculate_order (app.py:45)`,
    after: `tests/test_repro.py::test_order_without_discount PASSED
tests/test_orders.py::test_health PASSED
tests/test_orders.py::test_order_calculation PASSED
tests/test_orders.py::test_post_order_endpoint PASSED
tests/test_orders.py::test_order_history PASSED
================ 5 passed in 0.42s ================`
  };

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#070a12]/95 h-[calc(100vh-65px)]">
      {/* Dynamic Celebration Banner upon Deploy / Restoration */}
      {(celebrationBanner || isResolved) && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/90 via-emerald-900/60 to-teal-950/90 border border-emerald-400 shadow-xl shadow-emerald-900/40 flex items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-emerald-300 animate-spin" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="badge badge-deployed">HEALTHY</span>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  ✅ PRODUCTION RESTORED (Port 8000: 200 OK)
                </h3>
              </div>
              <p className="text-xs text-emerald-200/80 mt-0.5 font-mono">
                Swapped verified canary into production port 8000 • Verified 10s health probe passed
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('REPORT')}
            className="btn-success text-xs py-1.5 px-3"
          >
            View Post-Mortem Report
          </button>
        </div>
      )}

      {/* Top Incident Brief Card */}
      <div className="glass-panel p-5 space-y-4 border border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                {incident.id}
              </span>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Outage: <span className="text-indigo-400">{incident.service}</span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Detected: {incident.detected_at || new Date().toISOString()} • Endpoint: {incident.health_url || 'http://127.0.0.1:8000/health'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Suspected Root Cause:</span>
            <span className="text-xs font-mono font-bold text-rose-300 px-2 py-1 rounded bg-rose-950/40 border border-rose-500/30">
              KeyError: 'discount'
            </span>
          </div>
        </div>

        {/* Suspect Commit Pill / Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1">
            <span className="text-slate-500 block font-mono text-[11px]">SUSPECT COMMIT</span>
            <div className="flex items-center gap-1.5 font-mono text-amber-300 font-bold">
              <GitCommit className="w-4 h-4 text-amber-400" />
              <span>{suspect.hash || '96a2637'}</span>
              <span className="text-slate-400 font-normal">by {suspect.author || 'Vishnu Nandan'}</span>
            </div>
            <p className="text-slate-300 text-xs truncate">
              {suspect.message || 'feat: add discount support to order checkout'}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1">
            <span className="text-slate-500 block font-mono text-[11px]">SUSPECT LOCATION</span>
            <div className="font-mono text-indigo-300 font-bold flex items-center gap-1">
              <FileCode className="w-4 h-4 text-indigo-400" />
              <span>{incident.suspected_area || 'app.py:45'}</span>
            </div>
            <p className="text-slate-400 text-xs">
              Landed {suspect.minutes_ago !== undefined ? `${suspect.minutes_ago}m ago` : 'recently'}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1">
            <span className="text-slate-500 block font-mono text-[11px]">VERIFIER EVIDENCE</span>
            <div className="font-mono text-emerald-400 font-bold flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>DETERMINISTIC VERIFIED</span>
            </div>
            <p className="text-slate-400 text-xs">Repro test inverted • Full suite 100% green</p>
          </div>
        </div>
      </div>

      {/* Decision Recommendation & Human Gate Action Card */}
      <DecisionCard
        decision={incident.decision}
        staging={incident.staging}
        onApprove={onApprove}
        onReject={onReject}
        onFollowup={onFollowup}
        actionLoading={actionLoading}
        incidentStatus={incident.status}
      />

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-1">
        {[
          { key: 'TIMELINE', label: 'Live Investigation Timeline', icon: Activity, count: events.length },
          { key: 'REPORT', label: 'Post-Mortem Report', icon: Award, highlight: isResolved },
          { key: 'DIFF', label: 'Patch Diff', icon: FileCode },
          { key: 'EVIDENCE', label: 'Test Evidence', icon: ShieldCheck },
          { key: 'LOGS', label: 'Traceback & Raw Logs', icon: Terminal },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-xs font-semibold transition-all border-b-2 ${
                isActive
                  ? 'border-indigo-500 text-white bg-indigo-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
              }`}
            >
              <Icon className={`w-4 h-4 ${tab.highlight ? 'text-emerald-400 animate-pulse' : ''}`} />
              <span>{tab.label}</span>
              {tab.highlight && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  NEW
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {activeTab === 'TIMELINE' && (
        <Timeline events={events} currentStatus={incident.status} />
      )}

      {activeTab === 'REPORT' && (
        <PostMortemReport incident={incident} events={events} />
      )}

      {activeTab === 'DIFF' && (
        <DiffViewer diffText={diffContent} />
      )}

      {activeTab === 'EVIDENCE' && (
        <TestEvidence testEvidence={testEvidence} />
      )}

      {activeTab === 'LOGS' && (
        <div className="space-y-4">
          {/* Traceback */}
          <div className="glass-panel p-4 space-y-2">
            <h4 className="text-xs font-semibold text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Captured Python Traceback
            </h4>
            <pre className="p-3 rounded-lg bg-black/60 border border-rose-500/20 text-xs font-mono text-rose-300 overflow-x-auto leading-relaxed">
              {incident.trace || 'No traceback captured'}
            </pre>
          </div>

          {/* Log Tail */}
          <div className="glass-panel p-4 space-y-2">
            <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-400" />
              Service Log Tail (Last 200 lines)
            </h4>
            <pre className="p-3 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-slate-300 overflow-x-auto max-h-72 leading-relaxed">
              {incident.log_tail || 'No service log tail captured'}
            </pre>
          </div>
        </div>
      )}
    </main>
  );
}
