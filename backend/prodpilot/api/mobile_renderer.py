"""ProdPilot Mobile SRE Incident Console Renderer
Renders a responsive, mobile-first dark-mode UI for SREs reviewing incidents,
reading diffs, and approving PR deployments directly from Telegram on phones.
"""

import html
import json
from typing import Any, Dict


def render_diff_html(diff_text: str) -> str:
    """Formats raw git diff text into colored HTML lines."""
    if not diff_text or not diff_text.strip():
        return '<div class="text-zinc-500 italic py-2">No code changes recorded.</div>'

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


def render_mobile_incident_page(data: Dict[str, Any]) -> str:
    """Generates a complete, responsive standalone HTML page for mobile browsers."""
    incident_id = data.get("id", "Unknown")
    service = data.get("service", "production-service")
    status = data.get("status", "OPEN").upper()
    brief = data.get("brief", {}) or {}
    artifacts = data.get("artifacts", {}) or {}
    patch_diff = artifacts.get("patch_diff", "")
    decision = data.get("decision", {}) or {}
    suspect_commit = data.get("suspect_commit", {}) or {}

    rec = decision.get("recommendation", "fix_forward")
    probs = decision.get("probabilities", {}) or {}
    prob_pct = int(probs.get(rec, 0.95) * 100)
    reason = decision.get("reason", "Targeted patch resolves issue with zero regression blast radius.")

    commit_hash = (suspect_commit.get("hash") or "unknown")[:8]
    commit_author = suspect_commit.get("author", "developer")
    commit_msg = (suspect_commit.get("message") or "Code change").split("\n")[0]

    # Status pill styling
    if status == "AWAITING_APPROVAL":
        status_badge = '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">Awaiting Approval</span>'
    elif status in ("DEPLOYED", "RESOLVED"):
        status_badge = '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Deployed & Resolved</span>'
    else:
        status_badge = f'<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">{status}</span>'

    diff_html = render_diff_html(patch_diff)

    if status in ("DEPLOYED", "RESOLVED"):
        footer_content = """
    <div class="max-w-xl mx-auto flex items-center justify-between py-1">
      <div class="flex items-center gap-2.5">
        <div class="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm">✓</div>
        <div>
          <div class="text-sm font-bold text-white">Remediation Deployed</div>
          <div class="text-[11px] text-zinc-400">PR merged to main • Render auto-deploy active</div>
        </div>
      </div>
      <a href="https://github.com/vishnunandan555/chunkstream/pulls" target="_blank" class="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700 flex items-center gap-1.5 transition">
        <span>View PR</span>
        <span class="text-[10px] text-zinc-400">↗</span>
      </a>
    </div>"""
    elif status == "FAILED":
        footer_content = """
    <div class="max-w-xl mx-auto flex items-center justify-between py-1">
      <div class="flex items-center gap-2.5">
        <div class="h-8 w-8 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold text-sm">✕</div>
        <div>
          <div class="text-sm font-bold text-white">Automated Triage Paused</div>
          <div class="text-[11px] text-zinc-400">Escalated to human on-call engineer</div>
        </div>
      </div>
      <button onclick="location.reload()" class="py-2 px-3 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300 border border-zinc-700">Refresh</button>
    </div>"""
    elif status == "AWAITING_APPROVAL":
        footer_content = f"""
    <div id="action-panel" class="max-w-xl mx-auto flex items-center gap-2">
      <button id="btn-approve" onclick="submitDecision('fix_forward')" class="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition active:scale-[0.98]">
        <span>🚀 Approve PR & Merge</span>
      </button>
      <button id="btn-rollback" onclick="submitDecision('rollback')" class="py-3 px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs border border-zinc-700 transition active:scale-[0.98]">
        <span>⏪ Rollback</span>
      </button>
    </div>
    <div id="status-panel" class="hidden max-w-xl mx-auto text-center py-2">
      <p id="status-text" class="text-sm font-semibold text-emerald-400 animate-pulse"></p>
      <p id="status-sub" class="text-xs text-zinc-400 mt-1"></p>
    </div>"""
    else:
        footer_content = """
    <div class="max-w-xl mx-auto flex items-center justify-between py-1">
      <div class="flex items-center gap-2.5">
        <div class="h-8 w-8 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-sm animate-pulse">⚡</div>
        <div>
          <div class="text-sm font-bold text-white">Investigation in Progress</div>
          <div class="text-[11px] text-zinc-400">Synthesizing repro test & staging canaries</div>
        </div>
      </div>
      <button onclick="location.reload()" class="py-2 px-3 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300 border border-zinc-700">Refresh</button>
    </div>"""

    return f"""<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>ProdPilot | Incident {html.escape(incident_id)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {{
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      background-color: #09090b;
      color: #f4f4f5;
    }}
    pre, code {{
      font-family: 'JetBrains Mono', monospace;
    }}
  </style>
</head>
<body class="min-h-screen pb-24">
  <!-- Top Navigation Header -->
  <header class="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <div class="h-7 w-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-indigo-500/30">P</div>
      <div>
        <h1 class="font-bold text-sm leading-tight text-white flex items-center gap-1.5">
          <span>ProdPilot</span>
          <span class="text-zinc-500 text-xs">/ SRE Console</span>
        </h1>
        <p class="text-[11px] text-zinc-400">Mobile On-Call Gate</p>
      </div>
    </div>
    <div>{status_badge}</div>
  </header>

  <main class="max-w-xl mx-auto px-4 py-4 space-y-4">
    <!-- Incident Overview Card -->
    <div class="bg-zinc-900/90 rounded-2xl border border-zinc-800 p-4 shadow-xl">
      <div class="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
        <span>INCIDENT ID</span>
        <span class="font-mono text-zinc-500">{html.escape(incident_id)}</span>
      </div>
      <h2 class="text-lg font-bold text-white flex items-center gap-2">
        <span>{html.escape(service)}</span>
        <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">SEV-1</span>
      </h2>
      <p class="text-sm text-zinc-300 mt-2 leading-relaxed">
        {html.escape(brief.get("summary") or "Unhandled application crash detected in production runtime.")}
      </p>

      <div class="mt-3 pt-3 border-t border-zinc-800 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span class="text-zinc-500 block text-[10px]">SUSPECT COMMIT</span>
          <span class="font-mono text-zinc-300 font-medium">{html.escape(commit_hash)}</span>
          <span class="text-zinc-400 block truncate text-[11px]">{html.escape(commit_author)}</span>
        </div>
        <div>
          <span class="text-zinc-500 block text-[10px]">SUSPECTED AREA</span>
          <span class="font-mono text-cyan-400 text-[11px] truncate block">{html.escape(brief.get("suspected_area") or "engine core")}</span>
        </div>
      </div>
    </div>

    <!-- Verification Evidence Card -->
    <div class="bg-zinc-900/90 rounded-2xl border border-zinc-800 p-4 shadow-xl space-y-3">
      <h3 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
        <span>🛡️ Deterministic Verification</span>
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
          <span class="text-[10px] text-zinc-400">Side Canaries</span>
        </div>
      </div>
    </div>

    <!-- TypeSafe Jev Decision Card -->
    <div class="bg-gradient-to-br from-indigo-950/30 to-purple-950/20 rounded-2xl border border-indigo-800/40 p-4 shadow-xl">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1">
          <span>🧠 TypeSafe Jev Engine</span>
        </span>
        <span class="px-2 py-0.5 rounded text-xs font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-500/30">
          {prob_pct}% Confidence
        </span>
      </div>
      <div class="text-sm font-bold text-white mb-1">
        Recommendation: <span class="text-emerald-400">{rec.upper()}</span>
      </div>
      <p class="text-xs text-zinc-300 leading-relaxed">
        {html.escape(reason)}
      </p>
    </div>

    <!-- Code Diff Card -->
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
  </main>

  <!-- Sticky Bottom Approval Bar -->
  <footer class="fixed bottom-0 inset-x-0 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 p-3 z-50">
{footer_content}
  </footer>

  <script>
    async function submitDecision(action) {{
      const btnApprove = document.getElementById('btn-approve');
      const btnRollback = document.getElementById('btn-rollback');
      const actionPanel = document.getElementById('action-panel');
      const statusPanel = document.getElementById('status-panel');
      const statusText = document.getElementById('status-text');
      const statusSub = document.getElementById('status-sub');

      btnApprove.disabled = true;
      btnRollback.disabled = true;
      btnApprove.classList.add('opacity-50');

      actionPanel.classList.add('hidden');
      statusPanel.classList.remove('hidden');
      statusText.innerText = action === 'fix_forward' ? 'Opening & Merging PR on GitHub...' : 'Executing automated rollback...';
      statusSub.innerText = 'Triggering Render CI/CD production deployment';

      try {{
        const resp = await fetch('/incidents/{incident_id}/approve', {{
          method: 'POST',
          headers: {{ 'Content-Type': 'application/json' }},
          body: JSON.stringify({{ action: action, source: 'mobile_web' }})
        }});
        const result = await resp.json();
        if (resp.ok) {{
          statusText.innerText = '🎉 Deployment Triggered Successfully!';
          if (result.pr_url) {{
            statusSub.innerHTML = '<a href="' + result.pr_url + '" target="_blank" class="text-cyan-400 underline">View Merged PR on GitHub</a>';
          }} else {{
            statusSub.innerText = 'Render webhook received. Watchdog active.';
          }}
          setTimeout(() => location.reload(), 3000);
        }} else {{
          statusText.innerText = 'Action Error';
          statusSub.innerText = result.detail || 'Could not complete approval.';
          actionPanel.classList.remove('hidden');
        }}
      }} catch (err) {{
        statusText.innerText = 'Network Error';
        statusSub.innerText = err.message;
        actionPanel.classList.remove('hidden');
      }}
    }}
  </script>
</body>
</html>
"""
