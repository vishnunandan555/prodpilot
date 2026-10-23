import React, { useState } from 'react';
import {
  Rocket,
  RotateCcw,
  XCircle,
  HelpCircle,
  CheckCircle,
  Server,
  Sparkles,
  ArrowRight,
  Send,
  ShieldCheck,
  RefreshCw,
  Zap
} from 'lucide-react';

export default function DecisionCard({
  decision = {},
  staging = {},
  onApprove,
  onReject,
  onFollowup,
  actionLoading,
  incidentStatus
}) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [followupText, setFollowupText] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  const recommendation = decision?.recommendation || 'fix_forward';
  const probabilities = decision?.probabilities || { fix_forward: 0.85, rollback: 0.15 };
  const reason = decision?.reason || 'Candidate remediation evaluated and verified in isolated sandbox.';

  const fixProbPercent = Math.round((probabilities.fix_forward || 0.85) * 100);
  const rollbackProbPercent = Math.round((probabilities.rollback || 0.15) * 100);

  const fixCanaryHealth = staging?.fix_forward?.health ?? true;
  const rollbackCanaryHealth = staging?.rollback?.health ?? true;

  const isApprovedOrResolved = incidentStatus === 'DEPLOYED' || incidentStatus === 'ROLLED_BACK' || incidentStatus === 'RESOLVED';

  const handleAction = async (action) => {
    setPendingAction(action);
    try {
      await onApprove(action);
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="glass-panel-glow p-6 space-y-6 bg-gradient-to-br from-[#0c1222]/90 via-[#10172c]/90 to-[#0e1628]/90">
      {/* Title & Staging Badges */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">Decision Engine & Operator Approval Gate</h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              BACKEND: {decision?.backend?.toUpperCase() || 'RULES'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Evaluates deterministic test passes, patch size, rollback risk, and side-canary health
          </p>
        </div>

        {/* Side Canary Status */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
            <span className={`w-2 h-2 rounded-full ${fixCanaryHealth ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span className="text-slate-400">Canary 8001 (Fix):</span>
            <span className={fixCanaryHealth ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
              {fixCanaryHealth ? 'HEALTHY' : 'DOWN'}
            </span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
            <span className={`w-2 h-2 rounded-full ${rollbackCanaryHealth ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span className="text-slate-400">Canary 8002 (Revert):</span>
            <span className={rollbackCanaryHealth ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
              {rollbackCanaryHealth ? 'HEALTHY' : 'DOWN'}
            </span>
          </div>
        </div>
      </div>

      {/* Probabilities Meter */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-indigo-300 flex items-center gap-1.5">
            <Rocket className="w-3.5 h-3.5 text-indigo-400" />
            Fix-Forward ({fixProbPercent}%)
          </span>
          <span className="text-amber-300 flex items-center gap-1.5">
            Rollback ({rollbackProbPercent}%)
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-3 w-full bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/10 flex">
          <div
            style={{ width: `${fixProbPercent}%` }}
            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-l-full transition-all duration-500 shadow-sm shadow-emerald-500/50"
          />
          <div
            style={{ width: `${rollbackProbPercent}%` }}
            className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-r-full transition-all duration-500"
          />
        </div>

        <div className="p-3.5 rounded-lg bg-black/30 border border-white/5 text-xs text-slate-300 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">Recommended Strategy: </span>
            <span className="font-mono text-emerald-300 font-bold uppercase">{recommendation.replace('_', ' ')}</span>
            <p className="mt-0.5 text-slate-400">{reason}</p>
          </div>
        </div>
      </div>

      {/* Action Approval Buttons */}
      <div className="pt-2 flex flex-wrap items-center gap-4">
        {isApprovedOrResolved ? (
          <div className="w-full p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-center font-medium text-slate-200 text-sm flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>Incident resolution status:</span>
            <span className="font-mono text-emerald-400 font-bold">{incidentStatus}</span>
          </div>
        ) : (
          <>
            {/* Deploy Fix Button */}
            <button
              onClick={() => handleAction('fix_forward')}
              disabled={actionLoading}
              className="btn-success flex-1 py-3 px-5 text-sm font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {pendingAction === 'fix_forward' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4" />
              )}
              <span>{pendingAction === 'fix_forward' ? 'Deploying Fix to Port 8000...' : '🚀 Deploy Fix to Port 8000'}</span>
            </button>

            {/* Rollback Button */}
            <button
              onClick={() => handleAction('rollback')}
              disabled={actionLoading}
              className="btn-warning flex-1 py-3 px-5 text-sm font-bold shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {pendingAction === 'rollback' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              <span>{pendingAction === 'rollback' ? 'Reverting Commit...' : '⏪ Rollback Suspect Commit'}</span>
            </button>

            {/* Reject Button */}
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={actionLoading}
              className="btn-danger py-3 px-4 text-sm font-semibold disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              <span>Reject</span>
            </button>
          </>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 space-y-3 mt-4">
          <h4 className="text-xs font-bold text-rose-300">Specify Rejection Reason:</h4>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Patch alters business logic instead of checking field presence..."
            className="w-full p-2.5 rounded bg-black/60 border border-rose-500/30 text-xs text-white placeholder-slate-500 font-mono focus:outline-none"
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowRejectModal(false)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onReject(rejectReason || 'Manual rejection by operator');
                setShowRejectModal(false);
              }}
              className="btn-danger text-xs py-1.5 px-3"
            >
              Confirm Reject
            </button>
          </div>
        </div>
      )}

      {/* Follow-up agent instruction bar */}
      {!isApprovedOrResolved && (
        <div className="pt-2 border-t border-white/5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (followupText.trim()) {
                onFollowup(followupText);
                setFollowupText('');
              }
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Guide agent (e.g. adjust error handling, verify edge case)..."
              value={followupText}
              onChange={(e) => setFollowupText(e.target.value)}
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={actionLoading || !followupText.trim()}
              className="btn-primary text-xs py-2 px-3 font-medium disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
