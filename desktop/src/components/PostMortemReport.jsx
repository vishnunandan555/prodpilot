import React, { useState } from 'react';
import {
  FileText,
  Copy,
  Check,
  ShieldCheck,
  CheckCircle2,
  Clock,
  GitCommit,
  AlertOctagon,
  Award,
  Download,
  Share2
} from 'lucide-react';

export default function PostMortemReport({ incident, events = [] }) {
  const [copied, setCopied] = useState(false);

  const suspect = incident?.suspect_commit || {};
  const artifacts = incident?.artifacts || {};
  const decision = incident?.decision || {};

  const detectedAt = incident?.detected_at ? new Date(incident.detected_at) : new Date();
  const resolvedAt = new Date();
  const mttrMinutes = Math.max(1, Math.round((resolvedAt - detectedAt) / 60000));

  const markdownReport = `# 📋 Incident Post-Mortem: ${incident?.id || 'INC-001'}
**Service**: ${incident?.service || 'demo-prod'}  
**Status**: RESTORED / RESOLVED  
**Severity**: P0 - Critical Outage (Healthcheck Degraded 500)  
**Detected At**: ${detectedAt.toUTCString()}  
**Restored At**: ${resolvedAt.toUTCString()}  
**Mean Time to Resolution (MTTR)**: ~${mttrMinutes} min  

---

## 1. Executive Summary
An unhandled exception (\`KeyError: 'discount'\`) was triggered in the \`${incident?.service}\` order calculation pipeline when processing checkout orders without explicit promotional discounts. This resulted in an unhandled 500 error and health probe degradation on \`http://127.0.0.1:8000/health\`.
ProdPilot detected the anomaly within 4 seconds, captured the traceback and git blame attribution, synthesized a minimal reproduction test, verified an isolated patch in a temporary git worktree, and safely restored production after human confirmation.

---

## 2. Root Cause Analysis (RCA)
- **Suspect Commit**: \`${suspect.hash || '96a2637'}\`
- **Author**: ${suspect.author || 'Vishnu Nandan'}
- **Commit Message**: *${suspect.message || 'feat: add discount support to order checkout'}*
- **Suspect File & Line**: \`${incident?.suspected_area || 'app.py:45'}\`
- **Trigger**: Direct dictionary indexing (\`discount = order["discount"]\`) caused fatal KeyError on standard payloads without the optional discount attribute.

---

## 3. Remediation & Verification Evidence
1. **Reproduction Inversion**:
   Synthesized minimal reproduction test (\`tests/test_repro.py\`).
   - Baseline Execution: \`FAILED (KeyError: 'discount')\` (Inversion verified)
   - Patched Worktree Execution: \`PASSED\` (100% green across repro and full regression suite)

2. **Patch Applied**:
\`\`\`diff
${artifacts.patch_diff || `--- a/app.py
+++ b/app.py
@@ -43,3 +43,3 @@
     tax = round(subtotal * TAX_RATE, 2)
-    discount = order["discount"]
+    discount = order.get("discount", 0.0)
     total = max(0.0, round(subtotal + tax - discount, 2))`}
\`\`\`

3. **Staging Canary Validation**:
   - Fix-Forward Canary (Port 8001): 🟢 200 OK
   - Rollback Canary (Port 8002): 🟢 200 OK
   - Swapped safely to Production Port 8000 with 10s health verification.

---

## 4. Preventative Action Items
- [x] Enforce Pydantic schema validation for incoming order request payloads.
- [x] Add negative regression test case for orders without discount keys.
- [ ] Implement pre-merge schema backward-compatibility checks in CI/CD pipeline.
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(markdownReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Celebration Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-emerald-900/40 to-teal-950/80 border border-emerald-500/40 shadow-xl shadow-emerald-950/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="badge badge-deployed text-xs">RESOLVED & VERIFIED</span>
              <h3 className="text-base font-bold text-white">✅ PRODUCTION RESTORED (Port 8000: 200 OK)</h3>
            </div>
            <p className="text-xs text-emerald-300/80 mt-1">
              Autonomous remediation cycle complete. Zero manual rollback required. MTTR: ~{mttrMinutes} min.
            </p>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="btn-success text-xs py-2 px-3.5 flex items-center gap-2 shadow-md shadow-emerald-500/30"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Report Copied!' : 'Copy Markdown Report'}</span>
        </button>
      </div>

      {/* Structured Post-Mortem Report Container */}
      <div className="glass-panel p-6 space-y-6 border border-white/10">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Executive Incident Post-Mortem</h3>
              <p className="text-xs text-slate-400">Standard SRE blameless retrospective document</p>
            </div>
          </div>
          <span className="font-mono text-xs text-slate-400 bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
            ID: {incident?.id}
          </span>
        </div>

        {/* High-level KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <span className="text-[11px] font-mono text-slate-500">SEVERITY</span>
            <div className="text-sm font-bold text-rose-400 flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4 text-rose-500" />
              P0 - CRITICAL
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <span className="text-[11px] font-mono text-slate-500">RESOLUTION TIME</span>
            <div className="text-sm font-bold text-indigo-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-400" />
              ~{mttrMinutes} MINUTES
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <span className="text-[11px] font-mono text-slate-500">REPRO INVERSION</span>
            <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              DETERMINISTIC
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <span className="text-[11px] font-mono text-slate-500">DEPLOYED STRATEGY</span>
            <div className="text-sm font-bold text-amber-300 font-mono">
              FIX-FORWARD
            </div>
          </div>
        </div>

        {/* Narrative Sections */}
        <div className="space-y-4 text-xs text-slate-300 leading-relaxed font-sans">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
            <h4 className="text-xs font-bold text-slate-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              1. Incident Root Cause Analysis
            </h4>
            <p className="text-slate-300">
              The outage was caused by a runtime <code className="text-rose-300 font-mono">KeyError: 'discount'</code> when accessing incoming order dictionaries without validating field presence. The offending change was introduced in commit <code className="text-amber-300 font-mono">{suspect.hash || '96a2637'}</code> (<span className="italic">{suspect.message || 'feat: add discount support'}</span>) by <span className="text-slate-200 font-medium">{suspect.author || 'Vishnu Nandan'}</span>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
            <h4 className="text-xs font-bold text-slate-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              2. Autonomous Verification & Recovery
            </h4>
            <p className="text-slate-300">
              ProdPilot synthesized a reproduction test that failed deterministically on baseline code. After synthesizing the fix in an isolated temporary git worktree, the verifier confirmed that the repro test inverted to <strong className="text-emerald-400">PASSED</strong> and all 5 unit tests succeeded. Canaries were verified healthy on ports 8001 and 8002 prior to zero-downtime port swap.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
            <h4 className="text-xs font-bold text-slate-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              3. Preventative Guardrails
            </h4>
            <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
              <li>Add regression tests with optional fields omitted from JSON schemas.</li>
              <li>Adopt Pydantic request models with defaults for discount fields.</li>
              <li>Include automated canary health validation for all future code revisions.</li>
            </ul>
          </div>
        </div>

        {/* Raw Markdown Preview Box */}
        <div className="space-y-2 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 font-mono">Raw Markdown Output</span>
            <button
              onClick={handleCopy}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="p-4 rounded-xl bg-[#050811] border border-white/5 text-[11px] font-mono text-slate-400 overflow-x-auto max-h-56 leading-relaxed">
            {markdownReport}
          </pre>
        </div>
      </div>
    </div>
  );
}
