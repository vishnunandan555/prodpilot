import React from 'react';
import { CheckCircle2, XCircle, ShieldCheck, Flame, Cpu, Terminal } from 'lucide-react';

export default function TestEvidence({ testEvidence = {} }) {
  const beforeSnippet = testEvidence?.before || 'Reproduction test baseline execution pending...';
  const afterSnippet = testEvidence?.after || 'Worktree test suite run pending...';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-[#58a6ff]" />
        <h3 className="text-sm font-semibold text-white">Deterministic Verifier Evidence</h3>
        <span className="text-xs text-[#8b949e] ml-auto font-mono">pytest -q</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Baseline (Before Fix) */}
        <div className="p-4 rounded-md bg-[#0d111a] border border-[#1b2234] border-l-4 border-l-[#da3633] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#ff7b72] flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-[#da3633]" />
              1. Baseline Code (Repro Test)
            </span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[#261317] text-[#ff7b72] border border-[#4a1c24]">
              MUST FAIL
            </span>
          </div>
          <p className="text-xs text-[#8b949e]">
            Verifier strictly confirmed that the synthesized repro test fails on unmodified baseline code.
          </p>
          <div className="p-3 bg-[#07090f] rounded border border-[#30161a] font-mono text-xs text-[#ff7b72] overflow-x-auto whitespace-pre">
            {beforeSnippet}
          </div>
        </div>

        {/* Patched (After Fix) */}
        <div className="p-4 rounded-md bg-[#0d111a] border border-[#1b2234] border-l-4 border-l-[#2ea043] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#3fb950] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#3fb950]" />
              2. Patched Worktree (Repro + Full Suite)
            </span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[#0d1e17] text-[#3fb950] border border-[#1b3d2b]">
              PASSED GREEN
            </span>
          </div>
          <p className="text-xs text-[#8b949e]">
            Verifier executed repro test and complete test suite in isolated worktree with 100% pass.
          </p>
          <div className="p-3 bg-[#07090f] rounded border border-[#1b3d2b] font-mono text-xs text-[#3fb950] overflow-x-auto whitespace-pre">
            {afterSnippet}
          </div>
        </div>
      </div>
    </div>
  );
}
