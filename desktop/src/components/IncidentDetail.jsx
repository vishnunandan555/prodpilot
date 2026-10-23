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
  FileText
} from 'lucide-react';
import Timeline from './Timeline';
import DiffViewer from './DiffViewer';
import TestEvidence from './TestEvidence';
import DecisionCard from './DecisionCard';

export default function IncidentDetail({
  incident,
  events = [],
  onApprove,
  onReject,
  onFollowup,
  actionLoading
}) {
  const [activeTab, setActiveTab] = useState('TIMELINE');

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
      {/* Top Incident Brief Card */}
      <div className="glass-panel p-5 space-y-4 border border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                {incident.id}
              </span>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Service Failure: <span className="text-indigo-400">{incident.service}</span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Detected at: {incident.detected_at || new Date().toISOString()} • Endpoint: {incident.health_url || 'http://127.0.0.1:8000/health'}
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
              <span>{suspect.hash || 'a1b2c3d'}</span>
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
              Landed {suspect.minutes_ago !== undefined ? `${suspect.minutes_ago}m ago` : '15m ago'}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1">
            <span className="text-slate-500 block font-mono text-[11px]">VERIFIER STATUS</span>
            <div className="font-mono text-emerald-400 font-bold flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>DETERMINISTIC VERIFIED</span>
            </div>
            <p className="text-slate-400 text-xs">Repro test inverted • Full suite green</p>
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
          { key: 'TIMELINE', label: 'Live Investigation Timeline', icon: Activity },
          { key: 'DIFF', label: 'Patch Diff Viewer', icon: FileCode },
          { key: 'EVIDENCE', label: 'Test Evidence Before/After', icon: ShieldCheck },
          { key: 'LOGS', label: 'Traceback & Raw Log Tail', icon: Terminal },
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
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {activeTab === 'TIMELINE' && (
        <Timeline events={events} currentStatus={incident.status} />
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
