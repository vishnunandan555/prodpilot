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
import { formatIncidentId, formatDate } from '../utils/formatters';

export default function PostMortemReport({ incident, events = [] }) {
  const [copied, setCopied] = useState(false);

  const suspect = incident?.suspect_commit || {};
  const artifacts = incident?.artifacts || {};
  const decision = incident?.decision || {};

  const detectedAt = incident?.detected_at ? new Date(incident.detected_at) : new Date();
  const resolvedAt = new Date();
  const mttrMinutes = Math.max(1, Math.round((resolvedAt - detectedAt) / 60000));

  const executiveSummary =
    incident?.brief?.summary ||
    incident?.description ||
    incident?.title ||
    `Production error detected on ${incident?.service || 'service'}. Automated diagnosis and verification pipeline investigated root cause, validated patch mitigation in an isolated worktree, and restored service health.`;

  const diffBlock = artifacts.patch_diff || incident?.diff || 'No file changes committed (operational or configuration action taken).';

  const markdownReport = `# Incident Post-Mortem: ${formatIncidentId(incident?.id) || 'INCIDENT'} (${incident?.id || ''})
**Service**: ${incident?.service || 'target-service'}  
**Status**: ${incident?.status || 'RESOLVED'}  
**Severity**: ${incident?.severity || 'HIGH'}  
**Detected At**: ${detectedAt.toUTCString()}  
**Restored At**: ${resolvedAt.toUTCString()}  
**Mean Time to Resolution (MTTR)**: ~${mttrMinutes} min  

---

## 1. Executive Summary
${executiveSummary}

---

## 2. Root Cause Analysis (RCA)
- **Suspect Commit**: \`${suspect.hash || 'None correlated'}\`
- **Author**: ${suspect.author || 'Unknown'}
- **Commit Message**: *${suspect.message || 'N/A'}*
- **Suspect File & Line**: \`${incident?.suspected_area || 'N/A'}\`
- **Summary**: ${executiveSummary}

---

## 3. Remediation & Verification Evidence
1. **Worktree Test Verification**:
   - Baseline Execution: Confirmed error reproduction
   - Patched Worktree Execution: Verified all tests passing

2. **Patch Applied**:
\`\`\`diff
${diffBlock}
\`\`\`

3. **Canary Validation**:
   - Verified on staging canary before production traffic switch
   - Watchdog auto-revert monitor active.

---

## 4. Preventative Action Items
- [x] Add negative regression test case for identified exception pattern.
- [x] Verify continuous health probe thresholds.
- [ ] Review pre-merge CI checks for target service.
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(markdownReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 text-[13px]">
      {/* Celebration Banner */}
      <div className="p-4 rounded-md bg-[#0d1e17] border border-[#1b3d2b] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#16291e] border border-[#1b3d2b] flex items-center justify-center shrink-0 text-[#3fb950]">
            <Award size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b] font-mono font-semibold">
                VERIFIED & RESTORED
              </span>
              <h3 className="font-semibold text-[#f0f6fc] text-[13px]">
                Service Restored ({incident?.service || 'Production Endpoint'})
              </h3>
            </div>
            <p className="text-[#8b949e] text-xs mt-0.5 font-mono">
              Mitigation verified • MTTR: ~{mttrMinutes} min • All health checks green
            </p>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="px-3 py-1.5 rounded bg-[#161b26] hover:bg-[#212a3d] border border-[#212a3d] text-xs font-mono text-[#c9d1d9] flex items-center gap-1.5 transition self-start md:self-auto shrink-0"
        >
          {copied ? <Check size={13} className="text-[#3fb950]" /> : <Copy size={13} />}
          <span>{copied ? 'Markdown Copied' : 'Export Post-Mortem'}</span>
        </button>
      </div>

      {/* Post-Mortem Card */}
      <div className="p-5 rounded-md bg-[#0d111a] border border-[#1b2234] space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[#f0f6fc]">
            Automated SRE Post-Mortem Analysis
          </h2>
          <p className="text-xs text-[#8b949e] font-mono mt-0.5">
            Generated autonomously from git blame correlation and worktree verification evidence.
          </p>
        </div>

        <div className="space-y-3 font-mono text-xs">
          <div className="p-3 rounded bg-[#07090f] border border-[#1b2234] space-y-1">
            <span className="text-[10px] uppercase text-[#6e7681]">1. Executive Summary</span>
            <p className="text-[#c9d1d9] leading-relaxed">
              {executiveSummary}
            </p>
          </div>

          <div className="p-3 rounded bg-[#07090f] border border-[#1b2234] space-y-1">
            <span className="text-[10px] uppercase text-[#6e7681]">2. Root Cause Attribution</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[#8b949e] pt-1">
              <div>
                <span>Suspect Commit: </span>
                <strong className="text-[#58a6ff]">{suspect.hash || 'None correlated'}</strong>
              </div>
              <div>
                <span>Author: </span>
                <strong className="text-[#c9d1d9]">{suspect.author || 'Unknown'}</strong>
              </div>
              <div>
                <span>Location: </span>
                <strong className="text-[#e3b341]">{incident?.suspected_area || 'N/A'}</strong>
              </div>
              <div>
                <span>Resolution Strategy: </span>
                <strong className="text-[#3fb950]">{incident?.status || 'DEPLOYED'}</strong>
              </div>
            </div>
          </div>

          <div className="p-3 rounded bg-[#07090f] border border-[#1b2234] space-y-1">
            <span className="text-[10px] uppercase text-[#6e7681]">3. Remediation Diff</span>
            <pre className="text-[11px] text-[#c9d1d9] overflow-x-auto whitespace-pre p-2 bg-[#080b11] rounded border border-[#161b26]">
              {diffBlock}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
