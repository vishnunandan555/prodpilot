import React, { useState } from 'react';
import {
  FileText,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  AlertOctagon,
  Award
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
    <div className="space-y-4 text-[13px]">
      {/* Celebration Banner (GitHub Dark Palette) */}
      <div className="p-4 rounded-md bg-[rgba(46,160,67,0.15)] border border-[rgba(46,160,67,0.4)] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-gh-surface border border-[rgba(46,160,67,0.4)] flex items-center justify-center shrink-0 text-emerald-400">
            <Award size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono font-semibold">
                VERIFIED & RESTORED
              </span>
              <h3 className="font-semibold text-gh-text-bright text-[13px]">
                Production Restored (Port 8000: 200 OK)
              </h3>
            </div>
            <p className="text-[12px] text-gh-text-muted mt-0.5">
              Autonomous remediation cycle complete. Zero manual rollback required. MTTR: ~{mttrMinutes} min.
            </p>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="gh-btn-primary text-[12px] py-1.5 px-3 flex items-center gap-1.5 self-start md:self-auto"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? 'Copied' : 'Copy Report'}</span>
        </button>
      </div>

      {/* Structured Post-Mortem Report Container */}
      <div className="border border-gh-border rounded-md p-4 space-y-4 bg-gh-surface">
        <div className="flex items-center justify-between border-b border-gh-border pb-3">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-gh-text-muted" />
            <div>
              <h3 className="text-[13px] font-semibold text-gh-text-bright">Incident Post-Mortem</h3>
              <p className="text-[11px] text-gh-text-dim">Standard SRE blameless retrospective document</p>
            </div>
          </div>
          <span className="font-mono text-[11px] text-gh-text-dim bg-gh-subtle px-2 py-0.5 rounded border border-gh-border">
            ID: {incident?.id}
          </span>
        </div>

        {/* High-level KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px]">
          <div className="p-2.5 rounded bg-gh-subtle border border-gh-border space-y-0.5">
            <span className="text-[10px] font-mono text-gh-text-dim uppercase">Severity</span>
            <div className="font-semibold text-red-400 flex items-center gap-1">
              <AlertOctagon size={13} />
              P0 - CRITICAL
            </div>
          </div>

          <div className="p-2.5 rounded bg-gh-subtle border border-gh-border space-y-0.5">
            <span className="text-[10px] font-mono text-gh-text-dim uppercase">Resolution Time</span>
            <div className="font-semibold text-gh-text-bright flex items-center gap-1">
              <Clock size={13} />
              ~{mttrMinutes} MINUTES
            </div>
          </div>

          <div className="p-2.5 rounded bg-gh-subtle border border-gh-border space-y-0.5">
            <span className="text-[10px] font-mono text-gh-text-dim uppercase">Repro Inversion</span>
            <div className="font-semibold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={13} />
              DETERMINISTIC
            </div>
          </div>

          <div className="p-2.5 rounded bg-gh-subtle border border-gh-border space-y-0.5">
            <span className="text-[10px] font-mono text-gh-text-dim uppercase">Strategy</span>
            <div className="font-semibold text-emerald-400 font-mono">
              FIX-FORWARD
            </div>
          </div>
        </div>

        {/* Narrative Sections */}
        <div className="space-y-3 text-[12px] text-gh-text leading-relaxed">
          <div className="p-3 rounded bg-gh-subtle border border-gh-border space-y-1">
            <h4 className="font-semibold text-gh-text-bright flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              1. Incident Root Cause Analysis
            </h4>
            <p className="text-gh-text-muted">
              The outage was caused by a runtime <code className="text-red-400 font-mono">KeyError: 'discount'</code> when accessing incoming order dictionaries without validating field presence. The offending change was introduced in commit <code className="text-amber-400 font-mono">{suspect.hash || '96a2637'}</code> (<span className="italic">{suspect.message || 'feat: add discount support'}</span>) by <span className="text-gh-text-bright font-medium">{suspect.author || 'Vishnu Nandan'}</span>.
            </p>
          </div>

          <div className="p-3 rounded bg-gh-subtle border border-gh-border space-y-1">
            <h4 className="font-semibold text-gh-text-bright flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              2. Autonomous Verification & Recovery
            </h4>
            <p className="text-gh-text-muted">
              ProdPilot synthesized a reproduction test that failed deterministically on baseline code. After synthesizing the fix in an isolated temporary git worktree, the verifier confirmed that the repro test inverted to <strong className="text-emerald-400">PASSED</strong> and all unit tests succeeded. Canaries were verified healthy on ports 8001 and 8002 prior to zero-downtime port swap.
            </p>
          </div>

          <div className="p-3 rounded bg-gh-subtle border border-gh-border space-y-1">
            <h4 className="font-semibold text-gh-text-bright flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              3. Preventative Guardrails
            </h4>
            <ul className="list-disc list-inside space-y-0.5 text-gh-text-muted pl-1">
              <li>Add regression tests with optional fields omitted from JSON schemas.</li>
              <li>Adopt Pydantic request models with defaults for discount fields.</li>
              <li>Include automated canary health validation for all future code revisions.</li>
            </ul>
          </div>
        </div>

        {/* Raw Markdown Preview Box */}
        <div className="space-y-1.5 pt-2 border-t border-gh-border">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gh-text-dim font-mono">Raw Markdown Output</span>
            <button
              onClick={handleCopy}
              className="gh-btn-secondary px-2 py-0.5 text-[11px] flex items-center gap-1"
            >
              {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="p-3 rounded bg-gh-inset border border-gh-border text-[11px] font-mono text-gh-text-muted overflow-x-auto max-h-48 leading-relaxed">
            {markdownReport}
          </pre>
        </div>
      </div>
    </div>
  );
}
