import React, { useState } from 'react';
import {
  Play,
  Code2,
  ChevronDown,
  ChevronRight,
  Brain,
  CheckCircle2,
  AlertTriangle,
  Send,
  Paperclip,
  Check,
  RefreshCw,
  GitPullRequest
} from 'lucide-react';
import PostMortemReport from './PostMortemReport';

export default function SessionView({
  incident,
  events = [],
  onApprove,
  onRollback,
  isDeploying,
  deploySuccess
}) {
  const [expandShell, setExpandShell] = useState(false);
  const [expandThought1, setExpandThought1] = useState(false);
  const [expandThought2, setExpandThought2] = useState(false);
  const [expandTools, setExpandTools] = useState(false);
  const [promptText, setPromptText] = useState('');

  const title = incident?.suspected_area
    ? `[INCIDENT] Fix ${incident.suspected_area} on /orders`
    : incident?.title || '[FEATURE] Create UI for MayFly Dashboard';

  const isResolved = incident?.status === 'RESOLVED' || incident?.status === 'DEPLOYED';

  return (
    <div className="flex-1 flex flex-col h-full bg-gh-canvas overflow-hidden">
      {/* Top Session Header Bar */}
      <div className="h-12 px-4 border-b border-gh-border bg-gh-surface flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="font-semibold text-[13px] text-gh-text-bright truncate">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="p-1.5 text-gh-text-muted hover:text-gh-text-bright hover:bg-gh-subtle rounded transition-colors" title="Run">
            <Play size={14} />
          </button>
          <button className="p-1.5 text-gh-text-muted hover:text-gh-text-bright hover:bg-gh-subtle rounded transition-colors" title="Open in VS Code">
            <Code2 size={15} />
          </button>

          {/* Green CTA Pill Button with Dropdown (Screenshot Match) */}
          <div className="relative inline-flex rounded-md shadow-sm">
            <button
              onClick={() => onApprove && onApprove(incident?.id, 'fix_forward')}
              disabled={isDeploying || incident?.status === 'DEPLOYED'}
              className="gh-btn-primary px-3 py-1 text-[12px] flex items-center gap-1.5"
            >
              <GitPullRequest size={13} />
              <span>{incident?.status === 'AWAITING_APPROVAL' ? 'Deploy Fix (8001)' : 'Create PR'}</span>
            </button>
            <button
              onClick={() => onRollback && onRollback(incident?.id)}
              disabled={isDeploying}
              className="gh-btn-primary px-1.5 py-1 border-l border-green-700 rounded-r-md text-[12px]"
              title="Alternative: Deploy Rollback"
            >
              <ChevronDown size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat & Tool Call Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-4xl w-full mx-auto">
        {/* Command block */}
        <div className="bg-gh-surface border border-gh-border rounded-md p-3 font-mono text-[12px] space-y-1">
          <div className="text-gh-text-dim">$ {incident ? 'pytest -q tests/test_orders.py' : 'go run ./cmd/mayfly gui'}</div>
          <div className="text-gh-text">
            {incident ? 'Running baseline order tests against port 8000...' : 'The process currently using port 7357 is mayfly with PID 68292 .'}
          </div>
        </div>

        {/* Collapsible: Read shell output */}
        <div>
          <button
            onClick={() => setExpandShell(!expandShell)}
            className="flex items-center gap-1.5 text-[12px] text-gh-text-muted hover:text-gh-text-bright"
          >
            {expandShell ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>Read shell output</span>
          </button>
          {expandShell && (
            <div className="mt-2 p-3 bg-gh-inset border border-gh-border rounded-md font-mono text-[11px] text-gh-text leading-relaxed">
              {incident?.log_tail || 'Verified test_orders.py reproduction and staged canaries on side-ports 8001 & 8002.'}
            </div>
          )}
        </div>

        {/* Narrative explanation */}
        <p className="text-[13px] text-gh-text leading-relaxed">
          The latest code changes pass the full test suite. The automated reproduction test verified the baseline failure and confirmed that the patch fixes the error without breaking any existing endpoints.
        </p>

        {/* Collapsible: Thought for 1s */}
        <div>
          <button
            onClick={() => setExpandThought1(!expandThought1)}
            className="flex items-center gap-1.5 text-[12px] text-gh-text-muted hover:text-gh-text-bright"
          >
            <Brain size={13} className="text-gh-text-dim" />
            <span>Thought for 1s</span>
            {expandThought1 ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          {expandThought1 && (
            <div className="mt-2 pl-4 border-l-2 border-gh-border text-[12px] text-gh-text-muted italic space-y-1">
              <div>Identified missing 'discount' key in JSON payload at models.py line 42.</div>
              <div>Generated deterministic reproduction test in tests/test_repro.py.</div>
            </div>
          )}
        </div>

        {/* Action sentence */}
        <p className="text-[13px] text-gh-text leading-relaxed">
          I'm finishing the remaining verification for the fix and the full staging checks, including the health check on Canary Port 8001, before marking the task ready for deployment.
        </p>

        {/* Collapsible: Run complete test suite and tool calls */}
        <div className="bg-gh-surface border border-gh-border rounded-md overflow-hidden">
          <button
            onClick={() => setExpandTools(!expandTools)}
            className="w-full flex items-center justify-between p-2.5 text-[12px] font-medium text-gh-text hover:bg-gh-subtle transition-colors"
          >
            <div className="flex items-center gap-2">
              <ChevronRight size={14} className={`transform transition-transform ${expandTools ? 'rotate-90' : ''}`} />
              <span>Run complete test suite and 2 other tool calls</span>
            </div>
            <span className="text-[11px] text-gh-green-text flex items-center gap-1">
              <CheckCircle2 size={12} /> All passed
            </span>
          </button>
          {expandTools && (
            <div className="p-3 bg-gh-inset border-t border-gh-border space-y-2 text-[11px] font-mono">
              <div className="flex items-center justify-between text-gh-text-muted">
                <span>1. git blame to locate suspect commit</span>
                <span className="text-emerald-400">PASSED</span>
              </div>
              <div className="flex items-center justify-between text-gh-text-muted">
                <span>2. pytest tests/test_repro.py (failed on baseline)</span>
                <span className="text-emerald-400">VERIFIED</span>
              </div>
              <div className="flex items-center justify-between text-gh-text-muted">
                <span>3. Staged Fix-Forward on Canary :8001</span>
                <span className="text-emerald-400">200 OK</span>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible: Thought for 1s */}
        <div>
          <button
            onClick={() => setExpandThought2(!expandThought2)}
            className="flex items-center gap-1.5 text-[12px] text-gh-text-muted hover:text-gh-text-bright"
          >
            <Brain size={13} className="text-gh-text-dim" />
            <span>Thought for 1s</span>
            {expandThought2 ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          {expandThought2 && (
            <div className="mt-2 pl-4 border-l-2 border-gh-border text-[12px] text-gh-text-muted italic">
              Confidence score calculated at 95% based on minimal 3-line diff and clean passing tests.
            </div>
          )}
        </div>

        {/* Narrative wrap-up */}
        <p className="text-[13px] text-gh-text leading-relaxed">
          Completed the bug fix and verified it. The production service can now safely be updated. Dual canaries remain available via port 8001 (fix forward) and 8002 (safe rollback baseline).
        </p>

        {/* Badge Row (Screenshot Match) */}
        <div className="flex items-center gap-2 pt-2">
          <span className="px-2.5 py-1 rounded-full bg-gh-surface border border-gh-border text-[12px] font-mono text-gh-text flex items-center gap-1.5">
            Changes <span className="text-emerald-400 font-semibold">+3</span> <span className="text-red-400 font-semibold">-1</span>
          </span>
          <span className="px-2.5 py-1 rounded-full bg-gh-surface border border-gh-border text-[12px] text-gh-text flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Issue #{incident?.id || 1}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-gh-surface border border-gh-border text-[12px] text-gh-text flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Canary 8001 / 8002
          </span>
        </div>

        {/* Action / Approval Card (Screen 1 Match) */}
        {incident?.status === 'AWAITING_APPROVAL' && (
          <div className="p-4 bg-gh-surface border border-gh-border rounded-lg space-y-3">
            <div className="font-semibold text-[13px] text-gh-text-bright">
              Deploy Fix to Production?
            </div>
            <p className="text-[12px] text-gh-text-muted leading-relaxed">
              Allow ProdPilot to promote verified Canary 8001 onto production port 8000. Full test suite passed and zero regressions were detected.
            </p>
            <div className="space-y-1.5 pt-1">
              <button
                onClick={() => onApprove && onApprove(incident.id, 'fix_forward')}
                disabled={isDeploying}
                className="w-full text-left px-3 py-2 rounded bg-gh-subtle hover:bg-gh-border border border-gh-border text-[12px] text-gh-text-bright flex items-center justify-between transition-colors"
              >
                <span><strong>A.</strong> Always deploy fix (Port 8001)</span>
                <span className="text-[11px] text-gh-text-dim font-mono">Enter</span>
              </button>
              <button
                onClick={() => onRollback && onRollback(incident.id)}
                disabled={isDeploying}
                className="w-full text-left px-3 py-2 rounded bg-gh-subtle hover:bg-gh-border border border-gh-border text-[12px] text-gh-text-muted flex items-center justify-between transition-colors"
              >
                <span><strong>B.</strong> Deploy Rollback to baseline (Port 8002)</span>
                <span className="text-[11px] text-gh-text-dim font-mono">Ctrl+R</span>
              </button>
            </div>
          </div>
        )}

        {/* Post-Mortem Report Display */}
        {isResolved && incident && (
          <div className="pt-4">
            <PostMortemReport incident={incident} />
          </div>
        )}
      </div>

      {/* Bottom Chat Prompt Input Box */}
      <div className="p-3 border-t border-gh-border bg-gh-surface flex-shrink-0">
        <div className="bg-gh-canvas border border-gh-border rounded-lg p-2.5 space-y-2 focus-within:border-gh-blue-border transition-colors">
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Ask Copilot or provide follow-up instructions..."
            rows={2}
            className="w-full bg-transparent text-[13px] text-gh-text placeholder-gh-text-dim resize-none outline-none"
          />
          <div className="flex items-center justify-between pt-1 text-gh-text-muted">
            <div className="flex items-center gap-2">
              <button className="p-1 hover:text-gh-text-bright rounded" title="Attach file">
                <Paperclip size={14} />
              </button>
              <span className="text-[11px] text-gh-text-dim font-mono">
                Google Antigravity SDK (agy 1.4.6)
              </span>
            </div>
            <button
              disabled={!promptText.trim()}
              className={`p-1.5 rounded transition-colors ${
                promptText.trim() ? 'bg-gh-green text-white hover:bg-gh-green-hover' : 'text-gh-text-dim cursor-not-allowed'
              }`}
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
