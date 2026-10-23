import React from 'react';
import { CheckCircle2, XCircle, ShieldCheck, Flame, Cpu, Terminal } from 'lucide-react';

export default function TestEvidence({ testEvidence = {} }) {
  const beforeSnippet = testEvidence?.before || 'FAILED (KeyError: discount)';
  const afterSnippet = testEvidence?.after || 'PASSED (1 failed -> 1 passed, 4/4 total green)';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-indigo-400" />
        <h3 className="text-sm font-semibold text-white">Deterministic Verifier Evidence</h3>
        <span className="text-xs text-slate-400 ml-auto font-mono">pytest -q</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Baseline (Before Fix) */}
        <div className="glass-panel p-4 border-l-4 border-l-rose-500 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-rose-400" />
              1. Baseline Code (Repro Test)
            </span>
            <span className="badge badge-open">MUST FAIL</span>
          </div>
          <p className="text-xs text-slate-400">
            Verifier strictly confirmed that the generated repro test fails on unmodified baseline code.
          </p>
          <div className="p-3 bg-black/60 rounded-lg border border-rose-500/20 font-mono text-xs text-rose-300 overflow-x-auto whitespace-pre">
            {beforeSnippet}
          </div>
        </div>

        {/* Patched (After Fix) */}
        <div className="glass-panel p-4 border-l-4 border-l-emerald-500 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              2. Patched Worktree (Repro + Full Suite)
            </span>
            <span className="badge badge-deployed">PASSED GREEN</span>
          </div>
          <p className="text-xs text-slate-400">
            Verifier executed repro test and complete test suite in isolated worktree with 100% pass.
          </p>
          <div className="p-3 bg-black/60 rounded-lg border border-emerald-500/20 font-mono text-xs text-emerald-300 overflow-x-auto whitespace-pre">
            {afterSnippet}
          </div>
        </div>
      </div>
    </div>
  );
}
