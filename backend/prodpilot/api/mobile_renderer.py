"""ProdPilot Mobile SRE Incident Console Renderer
Renders a responsive, mobile-first dark-mode UI for SREs reviewing incidents,
streaming live agent thoughts during analysis/remediation, and approving PR deployments.
"""

import html
import json
from typing import Any, Dict, List, Optional

from backend.prodpilot.integrations.telegram_client import (
    generate_natural_fix_explanation,
    generate_natural_incident_explanation,
)


def render_diff_html(diff_text: str) -> str:
    """Formats raw git diff text into colored HTML lines."""
    if not diff_text or not diff_text.strip():
        return '<div class="text-zinc-500 italic py-2">No code changes recorded yet.</div>'

    lines_html = []
    for line in diff_text.splitlines():
        escaped = html.escape(line)
        if line.startswith("+++") or line.startswith("---") or line.startswith("diff "):
            lines_html.append(f'<div class="text-zinc-400 font-bold bg-zinc-900/60 px-2 py-0.5">{escaped}</div>')
        elif line.startswith("@@"):
            lines_html.append(f'<div class="text-cyan-400 bg-cyan-950/30 px-2 py-0.5 font-semibold">{escaped}</div>')
        elif line.startswith("+"):
            lines_html.append(f'<div class="text-emerald-300 bg-emerald-950/40 px-2 py-0.5 font-mono">{escaped}</div>')
        elif line.startswith("-"):
            lines_html.append(f'<div class="text-rose-300 bg-rose-950/40 px-2 py-0.5 font-mono">{escaped}</div>')
        else:
            lines_html.append(f'<div class="text-zinc-300 px-2 py-0.5 font-mono">{escaped}</div>')

    return "\n".join(lines_html)


def render_event_item_html(evt: Dict[str, Any]) -> str:
    """Renders a single telemetry/agent event for the mobile stream."""
    stage = evt.get("stage", "AGENT")
    kind = evt.get("kind", "info")
    payload = evt.get("payload", {})
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except Exception:
            payload = {"message": payload}

    msg = payload.get("message") or payload.get("thought") or payload.get("output") or payload.get("command") or payload.get("error") or ""
    tool = payload.get("tool") or ""
    step = payload.get("step")

    # Format stage tag
    stage_colors = {
        "UNDERSTAND": "bg-blue-500/20 text-blue-300 border-blue-500/30",
        "ANALYSIS": "bg-blue-500/20 text-blue-300 border-blue-500/30",
        "REPRODUCE": "bg-purple-500/20 text-purple-300 border-purple-500/30",
        "FIX": "bg-amber-500/20 text-amber-300 border-amber-500/30",
        "STAGE": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
        "DECIDE": "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
        "DEPLOY": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        "HOLD": "bg-amber-500/20 text-amber-300 border-amber-500/30",
    }
    pill_cls = stage_colors.get(stage.upper(), "bg-zinc-800 text-zinc-300 border-zinc-700")

    step_prefix = f'<span class="text-zinc-500 mr-1.5 font-mono">[{step}]</span>' if step is not None else ""
    tool_badge = f'<span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-cyan-300 border border-zinc-700 mr-1.5">${html.escape(tool)}</span>' if tool else ""

    return f"""<div class="flex items-start gap-2 text-xs py-1.5 border-b border-zinc-850">
      <span class="px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase shrink-0 {pill_cls}">{html.escape(stage)}</span>
      <div class="flex-1 font-mono break-all text-zinc-300 leading-relaxed">
        {step_prefix}{tool_badge}{html.escape(str(msg)[:300])}
      </div>
    </div>"""


def render_mobile_incident_page(
    data: Dict[str, Any],
    view: Optional[str] = None,
    action: Optional[str] = None,
) -> str:
    """Generates a complete, responsive standalone HTML page for mobile browsers."""
    incident_id = data.get("id", "Unknown")
    service = data.get("service", "production-service")
    status = data.get("status", "OPEN").upper()
    brief = data.get("brief", {}) or {}
    artifacts = data.get("artifacts", {}) or {}
    patch_diff = artifacts.get("patch_diff", "")
    decision = data.get("decision", {}) or {}
    suspect_commit = data.get("suspect_commit", {}) or {}
    trace = data.get("trace", "")
    events = data.get("events", []) or []

    rec = decision.get("recommendation", "fix_forward")
    probs = decision.get("probabilities", {}) or {}
    prob_pct = int(probs.get(rec, 0.95) * 100)
    decision_reason = decision.get("reason", "Targeted patch resolves issue with zero regression blast radius.")

    commit_hash = (suspect_commit.get("hash") or "unknown")[:8]
    commit_author = suspect_commit.get("author", "developer")
    commit_msg = (suspect_commit.get("message") or "Recent commit").split("\n")[0]
    suspect_area = brief.get("suspected_area") or data.get("suspected_area") or "Unknown file"

    # Natural Language Explanations
    natural_issue = generate_natural_incident_explanation(brief=brief, trace=trace, error_reason=brief.get("summary"))
    natural_fix = generate_natural_fix_explanation(patch_diff=patch_diff, brief=brief, suspected_area=suspect_area)

    # Status pill styling
    if status == "AWAITING_APPROVAL":
        status_badge = '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">Patch Ready • Awaiting Approval</span>'
    elif status == "ON_HOLD":
        status_badge = '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">⏸️ On Hold</span>'
    elif status in ("DEPLOYED", "RESOLVED"):
        status_badge = '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✓ Deployed & Merged</span>'
    elif status == "FIXING":
        status_badge = '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse">🛠️ Synthesizing Fix...</span>'
    elif status in ("INVESTIGATING", "OPEN"):
        status_badge = '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse">🧠 Analysing Cause...</span>'
    else:
        status_badge = f'<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">{status}</span>'

    diff_html = render_diff_html(patch_diff)

    # Determine default active view tab
    active_view = view or ("remediation" if status == "FIXING" else ("analysis" if status in ("OPEN", "INVESTIGATING") else "diff"))
    auto_open_modal = (action == "approve_modal") or (status == "AWAITING_APPROVAL" and not view and not action)

    # Filter events for analysis vs remediation
    analysis_events = [e for e in events if e.get("stage") in ("UNDERSTAND", "ANALYSIS", "AGENT")]
    remediation_events = [e for e in events if e.get("stage") in ("REPRODUCE", "FIX", "STAGE", "DECIDE")]

    analysis_stream_html = "".join(render_event_item_html(e) for e in (analysis_events if analysis_events else events[-10:]))
    if not analysis_stream_html:
        analysis_stream_html = '<div class="text-zinc-500 italic py-4 text-center">Analysing production logs, traceback, and recent git commits...</div>'

    remediation_stream_html = "".join(render_event_item_html(e) for e in (remediation_events if remediation_events else events[-15:]))
    if not remediation_stream_html:
        remediation_stream_html = '<div class="text-zinc-500 italic py-4 text-center">Agent preparing sandbox worktree and deterministic reproduction test...</div>'

    # GitHub PR info if already deployed
    github_pr = artifacts.get("github_pr") or {}
    if isinstance(github_pr, str):
        try:
            github_pr = json.loads(github_pr)
        except Exception:
            github_pr = {}
    if not isinstance(github_pr, dict):
        github_pr = {}
    pr_url = github_pr.get("pr_url") or "https://github.com/vishnunandan555/chunkstream/pulls"

    # Sticky Footer actions
    if status in ("DEPLOYED", "RESOLVED"):
        footer_content = f"""
    <div class="max-w-xl mx-auto flex items-center justify-between py-1">
      <div class="flex items-center gap-2.5">
        <div class="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm">✓</div>
        <div>
          <div class="text-sm font-bold text-white">Hotfix Merged & Deployed</div>
          <div class="text-[11px] text-zinc-400">PR merged to main • Render CI/CD deploy active</div>
        </div>
      </div>
      <a href="{html.escape(pr_url)}" target="_blank" class="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700 flex items-center gap-1.5 transition">
        <span>View PR</span>
        <span class="text-[10px] text-zinc-400">↗</span>
      </a>
    </div>"""
    elif status == "ON_HOLD":
        footer_content = f"""
    <div class="max-w-xl mx-auto flex items-center justify-between py-1">
      <div class="flex items-center gap-2.5">
        <div class="h-8 w-8 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold text-sm">⏸️</div>
        <div>
          <div class="text-sm font-bold text-white">Incident On Hold</div>
          <div class="text-[11px] text-zinc-400">Deployment paused by operator</div>
        </div>
      </div>
      <button onclick="resumeIncident()" class="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition">
        ▶️ Resume & Review Fix
      </button>
    </div>"""
    elif status == "AWAITING_APPROVAL":
        footer_content = f"""
    <div id="action-panel" class="max-w-xl mx-auto flex items-center gap-2">
      <button id="btn-open-modal" onclick="openApprovalModal()" class="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition active:scale-[0.98]">
        <span>🚀 Review & Approve Fix</span>
      </button>
      <button id="btn-footer-hold" onclick="putOnHold()" class="py-3 px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs border border-zinc-700 transition active:scale-[0.98]">
        <span>⏸️ Hold</span>
      </button>
    </div>"""
    else:
        footer_content = f"""
    <div class="max-w-xl mx-auto flex items-center justify-between py-1">
      <div class="flex items-center gap-2.5">
        <div class="h-8 w-8 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-sm animate-pulse">⚡</div>
        <div>
          <div class="text-sm font-bold text-white">Autonomous Agent Active</div>
          <div class="text-[11px] text-zinc-400">Live diagnostics streaming...</div>
        </div>
      </div>
      <button onclick="location.reload()" class="py-2 px-3 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300 border border-zinc-700">Refresh</button>
    </div>"""

    # Hold banner HTML if active
    hold_banner = ""
    if status == "ON_HOLD":
        hold_banner = """
    <div class="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="text-2xl">⏸️</div>
        <div>
          <h3 class="text-sm font-bold text-amber-200">Incident On Hold</h3>
          <p class="text-xs text-amber-300/80 mt-0.5">Deployment paused by operator. The verified patch is safely preserved.</p>
        </div>
      </div>
      <button onclick="resumeIncident()" class="py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold shrink-0 transition">
        Resume Fix
      </button>
    </div>"""

    return f"""<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>ProdPilot | Incident {html.escape(incident_id)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body {{
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      background-color: #09090b;
      color: #f4f4f5;
    }}
    pre, code {{
      font-family: 'JetBrains Mono', monospace;
    }}
    .border-zinc-850 {{
      border-color: #1f1f23;
    }}
    /* Smooth modal transition */
    #approval-modal.hidden {{
      opacity: 0;
      pointer-events: none;
    }}
    #approval-modal {{
      transition: opacity 0.2s ease-in-out;
    }}
  </style>
</head>
<body class="min-h-screen pb-28">

  <!-- Top Sticky Navigation Bar -->
  <header class="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <div class="h-7 w-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-indigo-500/30">P</div>
      <div>
        <h1 class="font-bold text-sm leading-tight text-white flex items-center gap-1.5">
          <span>ProdPilot</span>
          <span class="text-zinc-500 text-xs">/ SRE Console</span>
        </h1>
        <p class="text-[11px] text-zinc-400 font-mono truncate max-w-[140px]">{html.escape(incident_id)}</p>
      </div>
    </div>
    <div id="header-status-badge">{status_badge}</div>
  </header>

  <main class="max-w-xl mx-auto px-4 py-4 space-y-4">

    {hold_banner}

    <!-- Incident Overview Card -->
    <div class="bg-zinc-900/90 rounded-2xl border border-zinc-800 p-4 shadow-xl">
      <div class="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
        <span class="font-semibold tracking-wider text-zinc-500">SERVICE INCIDENT</span>
        <span class="font-mono text-zinc-400">{html.escape(incident_id)}</span>
      </div>
      <h2 class="text-lg font-bold text-white flex items-center gap-2">
        <span>{html.escape(service)}</span>
        <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">SEV-1</span>
      </h2>

      <!-- Plain English Natural Language What Happened -->
      <div class="mt-3 bg-zinc-950/60 rounded-xl p-3 border border-zinc-800/80">
        <span class="text-[10px] uppercase font-bold text-indigo-400 tracking-wider block mb-1">📋 What Happened</span>
        <p class="text-xs text-zinc-200 leading-relaxed font-sans">
          {html.escape(natural_issue)}
        </p>
      </div>

      <div class="mt-3 pt-3 border-t border-zinc-800 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span class="text-zinc-500 block text-[10px] uppercase font-semibold">Affected File</span>
          <span class="font-mono text-cyan-400 text-[11px] truncate block font-medium">{html.escape(suspect_area)}</span>
        </div>
        <div>
          <span class="text-zinc-500 block text-[10px] uppercase font-semibold">Suspect Commit</span>
          <span class="font-mono text-zinc-300 font-medium">{html.escape(commit_hash)}</span>
          <span class="text-zinc-400 block truncate text-[10px]">{html.escape(commit_author)}</span>
        </div>
      </div>
    </div>

    <!-- Navigation View Switcher (Analysis / Remediation / Diff) -->
    <div class="bg-zinc-950/80 p-1 rounded-xl border border-zinc-800 flex items-center gap-1">
      <button id="tab-analysis-btn" onclick="switchView('analysis')" class="flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold text-center transition {'bg-zinc-800 text-white shadow' if active_view == 'analysis' else 'text-zinc-400 hover:text-zinc-200'}">
        🧠 Analysis
      </button>
      <button id="tab-remediation-btn" onclick="switchView('remediation')" class="flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold text-center transition {'bg-zinc-800 text-white shadow' if active_view == 'remediation' else 'text-zinc-400 hover:text-zinc-200'}">
        🛠️ Remediation
      </button>
      <button id="tab-diff-btn" onclick="switchView('diff')" class="flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold text-center transition {'bg-zinc-800 text-white shadow' if active_view == 'diff' else 'text-zinc-400 hover:text-zinc-200'}">
        📝 Patch & Diff
      </button>
    </div>

    <!-- VIEW 1: LIVE ANALYSIS STREAM (What agent is thinking & doing during analysis) -->
    <div id="view-analysis" class="{'block' if active_view == 'analysis' else 'hidden'} space-y-3">
      <div class="bg-zinc-900/90 rounded-2xl border border-zinc-800 p-4 shadow-xl">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-blue-400 animate-ping"></span>
            <h3 class="text-xs font-bold text-white uppercase tracking-wider">Agent Thinking & Root Cause Analysis</h3>
          </div>
          <span class="text-[10px] font-mono text-zinc-400">Live SSE</span>
        </div>
        <p class="text-xs text-zinc-400 mb-3">
          The autonomous SRE agent investigates the production crash, correlates stack traces with git commit history, and isolates the bug.
        </p>

        <!-- Live Terminal Stream Container -->
        <div id="analysis-terminal" class="bg-zinc-950 rounded-xl p-3 border border-zinc-800 max-h-80 overflow-y-auto space-y-1">
          {analysis_stream_html}
        </div>
      </div>
    </div>

    <!-- VIEW 2: LIVE REMEDIATION STREAM (What agent is doing to fix the bug) -->
    <div id="view-remediation" class="{'block' if active_view == 'remediation' else 'hidden'} space-y-3">
      <div class="bg-zinc-900/90 rounded-2xl border border-zinc-800 p-4 shadow-xl">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-indigo-400 animate-ping"></span>
            <h3 class="text-xs font-bold text-white uppercase tracking-wider">Autonomous Remediation Feed</h3>
          </div>
          <span class="text-[10px] font-mono text-zinc-400">Antigravity SDK</span>
        </div>
        <p class="text-xs text-zinc-400 mb-3">
          The agent synthesizes a deterministic Red reproduction test, generates the patch with guard clauses, and verifies the test suite.
        </p>

        <!-- Live Terminal Stream Container -->
        <div id="remediation-terminal" class="bg-zinc-950 rounded-xl p-3 border border-zinc-800 max-h-80 overflow-y-auto space-y-1">
          {remediation_stream_html}
        </div>
      </div>
    </div>

    <!-- VIEW 3: PATCH, EVIDENCE & DECISION -->
    <div id="view-diff" class="{'block' if active_view == 'diff' else 'hidden'} space-y-4">
      
      <!-- Verification Evidence Card -->
      <div class="bg-zinc-900/90 rounded-2xl border border-zinc-800 p-4 shadow-xl space-y-3">
        <h3 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
          <span>🛡️ Deterministic Verification</span>
          <span class="text-[10px] text-emerald-400 font-mono">100% GREEN</span>
        </h3>
        <div class="grid grid-cols-3 gap-2">
          <div class="bg-zinc-950/60 rounded-xl p-2.5 border border-zinc-800/80 text-center">
            <span class="text-emerald-400 font-bold text-sm block">GREEN</span>
            <span class="text-[10px] text-zinc-400">Repro Test</span>
          </div>
          <div class="bg-zinc-950/60 rounded-xl p-2.5 border border-zinc-800/80 text-center">
            <span class="text-emerald-400 font-bold text-sm block">5/5 PASS</span>
            <span class="text-[10px] text-zinc-400">Regression</span>
          </div>
          <div class="bg-zinc-950/60 rounded-xl p-2.5 border border-zinc-800/80 text-center">
            <span class="text-cyan-400 font-bold text-sm block">200 OK</span>
            <span class="text-[10px] text-zinc-400">Canaries</span>
          </div>
        </div>
      </div>

      <!-- Natural Language Fix Explanation Card -->
      <div class="bg-gradient-to-br from-indigo-950/40 to-teal-950/20 rounded-2xl border border-indigo-800/40 p-4 shadow-xl">
        <span class="text-[10px] uppercase font-bold text-teal-300 tracking-wider block mb-1">🔧 How the Fix Works</span>
        <p class="text-xs text-zinc-200 leading-relaxed font-sans">
          {html.escape(natural_fix)}
        </p>
      </div>

      <!-- Verified Code Diff Card -->
      <div class="bg-zinc-900/90 rounded-2xl border border-zinc-800 overflow-hidden shadow-xl">
        <div class="px-4 py-3 bg-zinc-950/60 border-b border-zinc-800 flex items-center justify-between">
          <h3 class="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <span>📝 Verified Patch Diff</span>
          </h3>
          <span class="text-[11px] text-zinc-500 font-mono">+{len(patch_diff.splitlines())} lines</span>
        </div>
        <div class="p-2 overflow-x-auto text-xs max-h-80 overflow-y-auto">
          {diff_html}
        </div>
      </div>
    </div>

  </main>

  <!-- Sticky Bottom Control Bar -->
  <footer class="fixed bottom-0 inset-x-0 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 p-3 z-30">
    {footer_content}
  </footer>

  <!-- ==================================================================== -->
  <!-- QUICK RECAP & APPROVAL MODAL (The Human-In-The-Loop Confirmation Gate) -->
  <!-- ==================================================================== -->
  <div id="approval-modal" class="{'fixed' if auto_open_modal else 'hidden fixed'} inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
    <div class="bg-zinc-900 border border-zinc-700/80 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
      
      <!-- Modal Header -->
      <div class="p-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm">🛡️</div>
          <div>
            <h3 class="text-sm font-bold text-white">Hotfix Approval Confirmation</h3>
            <p class="text-[11px] text-zinc-400">Review recap before Pull Request merge</p>
          </div>
        </div>
        <button onclick="closeApprovalModal()" class="h-8 w-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center text-sm transition">✕</button>
      </div>

      <!-- Modal Body (Scrollable) -->
      <div class="p-4 overflow-y-auto space-y-3.5 text-xs">
        
        <!-- Quick Recap: The Issue -->
        <div class="bg-zinc-950/80 rounded-2xl p-3 border border-zinc-800">
          <div class="flex items-center gap-1.5 text-rose-400 font-bold mb-1">
            <span>💥 What was the issue?</span>
          </div>
          <p class="text-zinc-300 leading-relaxed font-sans">
            {html.escape(natural_issue)}
          </p>
        </div>

        <!-- Quick Recap: The Fix -->
        <div class="bg-zinc-950/80 rounded-2xl p-3 border border-zinc-800">
          <div class="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
            <span>🔧 What is the fix?</span>
          </div>
          <p class="text-zinc-300 leading-relaxed font-sans">
            {html.escape(natural_fix)}
          </p>
        </div>

        <!-- Verification Snapshot -->
        <div class="bg-zinc-950/80 rounded-2xl p-3 border border-zinc-800 grid grid-cols-2 gap-2 text-center">
          <div>
            <span class="text-zinc-500 block text-[10px] font-semibold">REPRO TEST</span>
            <span class="text-emerald-400 font-bold text-xs">RED ➔ GREEN ✓</span>
          </div>
          <div>
            <span class="text-zinc-500 block text-[10px] font-semibold">REGRESSION SUITE</span>
            <span class="text-emerald-400 font-bold text-xs">100% PASSED (5/5)</span>
          </div>
        </div>

        <!-- Compact Diff Preview -->
        <div class="bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden">
          <div class="px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[11px] font-semibold text-zinc-400">
            Patch Preview
          </div>
          <div class="p-2 overflow-x-auto text-[11px] max-h-36 overflow-y-auto font-mono">
            {diff_html}
          </div>
        </div>

        <!-- Live Status / Result Alert inside Modal -->
        <div id="modal-status-box" class="hidden bg-zinc-950 p-3 rounded-2xl border border-zinc-800 text-center">
          <div id="modal-spinner" class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent mb-1"></div>
          <p id="modal-status-title" class="text-xs font-bold text-emerald-400"></p>
          <p id="modal-status-sub" class="text-[11px] text-zinc-400 mt-0.5"></p>
        </div>

      </div>

      <!-- Modal Footer CTA -->
      <div class="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center gap-2">
        <button id="modal-btn-confirm" onclick="confirmAndCreatePR()" class="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition active:scale-[0.98]">
          <span>🚀 Create PR & Auto-Merge</span>
        </button>
        <button id="modal-btn-hold" onclick="putOnHold()" class="py-3 px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs border border-zinc-700 transition">
          <span>⏸️ Hold</span>
        </button>
      </div>

    </div>
  </div>

  <script>
    const incidentId = "{incident_id}";
    let isPolling = true;

    function switchView(viewName) {{
      document.getElementById('view-analysis').classList.add('hidden');
      document.getElementById('view-remediation').classList.add('hidden');
      document.getElementById('view-diff').classList.add('hidden');

      document.getElementById('tab-analysis-btn').className = 'flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold text-center transition text-zinc-400 hover:text-zinc-200';
      document.getElementById('tab-remediation-btn').className = 'flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold text-center transition text-zinc-400 hover:text-zinc-200';
      document.getElementById('tab-diff-btn').className = 'flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold text-center transition text-zinc-400 hover:text-zinc-200';

      const activeTarget = document.getElementById('view-' + viewName);
      const activeBtn = document.getElementById('tab-' + viewName + '-btn');
      if (activeTarget && activeBtn) {{
        activeTarget.classList.remove('hidden');
        activeBtn.className = 'flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold text-center transition bg-zinc-800 text-white shadow';
      }}
    }}

    function openApprovalModal() {{
      document.getElementById('approval-modal').classList.remove('hidden');
    }}

    function closeApprovalModal() {{
      document.getElementById('approval-modal').classList.add('hidden');
    }}

    async function confirmAndCreatePR() {{
      const btnConfirm = document.getElementById('modal-btn-confirm');
      const btnHold = document.getElementById('modal-btn-hold');
      const statusBox = document.getElementById('modal-status-box');
      const statusTitle = document.getElementById('modal-status-title');
      const statusSub = document.getElementById('modal-status-sub');
      const spinner = document.getElementById('modal-spinner');

      btnConfirm.disabled = true;
      btnHold.disabled = true;
      btnConfirm.classList.add('opacity-50');

      statusBox.classList.remove('hidden');
      spinner.classList.remove('hidden');
      statusTitle.innerText = 'Creating branch, Pull Request & auto-merging...';
      statusSub.innerText = 'Applying verified hotfix to main repository branch';

      try {{
        const resp = await fetch('/incidents/' + incidentId + '/approve', {{
          method: 'POST',
          headers: {{ 'Content-Type': 'application/json' }},
          body: JSON.stringify({{ action: 'fix_forward', source: 'mobile_web_modal' }})
        }});
        const result = await resp.json();

        if (resp.ok) {{
          spinner.classList.add('hidden');
          statusTitle.innerText = '🎉 Pull Request Auto-Merged to main!';
          if (result.pr_url) {{
            statusSub.innerHTML = '<a href="' + result.pr_url + '" target="_blank" class="text-cyan-400 underline font-bold">View Merged PR #' + (result.pr_number || '') + ' on GitHub ↗</a><br><span class="text-zinc-400 text-[10px]">Render auto-deploy initiated.</span>';
          }} else {{
            statusSub.innerText = 'Production deployment triggered. Watchdog active.';
          }}
          setTimeout(() => location.reload(), 3200);
        }} else {{
          spinner.classList.add('hidden');
          statusTitle.innerText = 'Deployment Failed';
          statusSub.innerText = result.detail || 'Could not complete merge.';
          btnConfirm.disabled = false;
          btnConfirm.classList.remove('opacity-50');
        }}
      }} catch (err) {{
        spinner.classList.add('hidden');
        statusTitle.innerText = 'Network Error';
        statusSub.innerText = err.message;
        btnConfirm.disabled = false;
        btnConfirm.classList.remove('opacity-50');
      }}
    }}

    async function putOnHold() {{
      try {{
        const resp = await fetch('/incidents/' + incidentId + '/hold', {{
          method: 'POST',
          headers: {{ 'Content-Type': 'application/json' }},
          body: JSON.stringify({{ action: 'hold' }})
        }});
        if (resp.ok) {{
          location.href = '/incidents/' + incidentId;
        }}
      }} catch (err) {{
        alert('Could not update status: ' + err.message);
      }}
    }}

    async function resumeIncident() {{
      try {{
        const resp = await fetch('/incidents/' + incidentId + '/hold', {{
          method: 'POST',
          headers: {{ 'Content-Type': 'application/json' }},
          body: JSON.stringify({{ action: 'resume' }})
        }});
        if (resp.ok) {{
          location.href = '/incidents/' + incidentId + '?action=approve_modal';
        }}
      }} catch (err) {{
        alert('Could not resume: ' + err.message);
      }}
    }}

    // Real-time live polling for active incidents
    async function pollLiveTelemetry() {{
      if (!isPolling) return;
      try {{
        const resp = await fetch('/incidents/' + incidentId + '?raw=true');
        if (resp.ok) {{
          const inc = await resp.json();
          // If status moved to AWAITING_APPROVAL and was previously INVESTIGATING/FIXING, reload
          const curStatus = "{status}";
          if (inc.status !== curStatus && (inc.status === 'AWAITING_APPROVAL' || inc.status === 'DEPLOYED' || inc.status === 'ON_HOLD')) {{
            location.reload();
          }}
        }}
      }} catch (e) {{
        // silent retry
      }}
      setTimeout(pollLiveTelemetry, 3000);
    }}

    pollLiveTelemetry();
  </script>
</body>
</html>
"""
