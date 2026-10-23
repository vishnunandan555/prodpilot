# ProdPilot - Project Blueprint

Realm Hack 2026 | Agentic AI track | Vishnu Nandan, Christ College of Engineering

## 1. Vision

ProdPilot is a native desktop workspace that pulls a repo's issues, discussions and CI failures into one local place, turns each messy thread into a clear task, hands ready tasks to a coding agent working in an isolated checkout, proves the result with tests, and lets the developer approve or reject.

Pitch line: GitHub Copilot App recharged with autonomous incident recovery, readiness gates, and deterministic proof.

Positioning: ProdPilot starts by cloning the exact experience of the GitHub Copilot Desktop App on Linux (clean GitHub Dark aesthetic, session trees, live thought/tool streams, issues split-view, automations, and right inspector drawer). Powered by the local Google Antigravity SDK (`agy`), it supercharges Copilot with two mission-critical capabilities:
1. Daily Developer Mode: Issue-to-Draft-PR with a strict Readiness Gate (`ready: yes/no`) to block vague threads and a reproduction-first test loop.
2. Production Incident Mode (Hero Demo): Automatic 500 error detection on production, traceback extraction, git blame commit isolation, dual side-port canary staging (8001 fix-forward, 8002 rollback), and 1-tap phone deployment with post-mortem generation.

## 2. Problem focus

AI made writing code cheap. Investigating, verifying and recovering around that code is still manual, and that is now the bottleneck.

- Code is produced faster than it ships: feature-branch throughput up, main-branch throughput down, main-branch success rates at a five-year low (CircleCI 2026).
- AI output still needs human verification: most developers do not fully trust AI code, and fewer than half always check it before committing (Sonar, Jan 2026).
- Context is scattered across tools: finding info and switching tools are top time-wasters, and failed builds take over an hour to recover from (Atlassian DevEx 2025, CircleCI 2026).

Note: re-check every number against its original source before the pitch. Judges may ask.

Who feels it: maintainers, small teams without a dedicated DevOps person, solo developers, students contributing to open source.

The gap: existing tools cover one slice (write a patch, review a PR, show CI). Nobody gives one local workspace where the thread, the task, the reproduction, the fix, the proof and the decision live together.

## 3. What ProdPilot is and is not

Is:

- A local-first desktop app. Context, state and logs live on the user's machine (SQLite + filesystem).
- A pipeline: Understand -> Reproduce -> Fix -> Verify -> Decide -> Human approval.
- Agent-swappable: the coding agent sits behind an interface.
- Human-gated: nothing touches the remote repo without approval.

Is not:

- An autonomous merger. It never merges.
- A full observability platform. Incident mode watches one service through a health check and logs; it does not replace Datadog.
- A general chat IDE.
- A replacement for CI. It runs tests locally as evidence, CI stays the authority.

## 4. Users and scenarios

Primary user: a developer or maintainer with a backlog of issues and limited time.

Scenario A, happy path: a well-specified bug issue arrives. ProdPilot builds a brief (ready: yes), the agent writes a failing reproduction test, fixes the code, tests go green, the decision layer says send for approval, the developer reviews diff plus evidence and approves. A draft PR opens with a comment on the issue.

Scenario B, not ready: a vague issue with a long argumentative thread. ProdPilot's brief says what was decided, what is still open, ready: no. It drafts a clarifying comment instead of wasting an agent run. The developer approves the comment.

Scenario C, failure and recovery: the first fix breaks other tests. The verifier catches it, the decision layer picks retry with failure logs (or escalate to a stronger model), the second attempt passes. If the retry limit is hit, it stops and asks the human, with a full report.

## 5. Core features (must ship)

F1. GitHub workspace (read)

- Connect with a fine-grained PAT, pick one repo, list issues, open a thread view.
- Polling sync (every 15-30 s) into SQLite.
- Done when: new issue or comment on GitHub shows in the app within 30 s.

F2. Comment from inside the app

- Developer can reply on issues using the PAT. Agent comments carry a clear marker (for example a ProdPilot header) or use a separate bot account.
- Done when: a comment typed in the app appears on GitHub.

F3. Context Brief

- LLM reads issue + comments (+ CI/test log) and outputs structured JSON: task, decided, open\_questions, ready (yes/no), suspected\_area.
- Done when: the brief renders as a card above the thread.

F4. Readiness gate

- If ready is no, no agent run starts. The app drafts a clarifying comment for human approval.
- This is the main differentiator from plain issue-to-PR agents.

F5. Reproduction-first fixing

- Step 1: agent writes a failing test that reproduces the issue. Verifier confirms it fails on the unmodified code (if it passes, the test is invalid and is regenerated).
- Step 2: agent fixes the code.
- Done when: the evidence shows the test failing before and passing after.

F6. Verification with bounded retry

- Runs the repro test plus the full suite. Pass means repro passes and no previously passing test breaks.
- Failure logs go back to the agent. Max 2 retries.

F7. Decision layer with visible reasoning

- After each verify step it chooses: retry, retry with more context, escalate model tier, ask human, or abandon.
- The UI shows what it decided and why (answers and probabilities).

F8. Human gates

- Approve: push branch, open draft PR, comment evidence on the issue.
- Reject: discard the worktree, store the reason, optionally re-run with the reason as extra context.

F9. Live run timeline

- Every stage and agent step streams to the UI (SSE): stage, tool calls, test output, decisions.

## 6. Extended features (only after the core is demo-stable)

E1. Telegram bot: notify on brief ready / run finished / needs input, with inline Approve / Reject / Open buttons. Long polling, no public URL. Lock it to your own chat ID. E2. CI failure ingest: pull the latest failed workflow run log and treat it as an incident. E3. Ask the thread: chat box that answers questions about an issue using only the stored thread and brief. E4. Model-tier meter: show which tier ran each step and the estimated cost saved vs always using the strong model. E5. Run history: past runs, outcomes, rejection reasons. E6. Slack notifications (incoming webhook only, no interactivity). E7. Responsive dashboard reachable over LAN as the mobile story. E8. Multi-repo support.

Explicitly out for the hackathon (mention as roadmap only): voice or phone calls, native mobile app, MCP server, GitHub App, webhooks, auto-merge.

## 7. Architecture

```
[Electron + React UI] <--HTTP/SSE--> [FastAPI backend (Python)]
                                          |
        +---------------+-----------------+------------------+
        |               |                 |                  |
  GitHub client    Pipeline engine   Decision layer     Telegram bot
  (REST, PAT,      (state machine)   decide(state,      (optional)
   polling)             |            questions)
        |         +-----+------+          |
        |         |     |      |     Jev API  or  rule-based fallback
   SQLite + FS  Context Coding  Verifier
   (local)      brief   agent   (deterministic
                (LLM)   (Gemini  test runner)
                        tools,
                        git worktree)
```

What changed from the submitted deck:

| Deck | Blueprint | Why |
| --- | --- | --- |
| Context, Diagnosis, Execution, Verification agents | Context step, Coding agent (diagnose + fix + repro test), Verifier | Diagnosis and execution are one agent loop. Verification is deterministic. |
| Main Orchestrator + Github MCP | Pipeline state machine + direct REST client | One owner of state, no MCP layer to debug |
| Sync engine + webhooks | Polling | No public URL needed |
| Verifier creates the PR | PR is created only after human approval | Matches the human-in-control promise |
| Gemini SDK or Codex SDK | Antigravity SDK (own Gemini loop as fallback) | Decide once, stream every step |
| Jev / Laya decision layer | One decide() interface: Jev, or rules fallback | Demo survives an API outage |

The four-stage story (Integrate, Understand, Resolve, Verify and decide) stays as the user-facing narrative.

## 8. Pipeline and state machine

```
INGESTED -> BRIEFED
BRIEFED -> NOT_READY -> DRAFT_CLARIFYING_COMMENT -> (human) -> WAITING
BRIEFED -> READY -> REPRO_TEST -> FIX -> VERIFY
VERIFY pass -> AWAIT_APPROVAL
VERIFY fail -> DECIDE -> retry | retry_with_context | escalate | ask_human | abandon
AWAIT_APPROVAL -> APPROVED -> PR_OPENED
AWAIT_APPROVAL -> REJECTED -> (optional re-run with reason)
```

Rules:

- State is stored in SQLite after every transition, so a crash can resume.
- Max 2 retries per run, one escalation, hard timeout per stage.
- Every transition writes a run\_event row, which feeds the timeline.

## 9. Decision layer

A single interface: decide(state, questions) -> answers with probabilities. Two backends behind it:

- Jev (hosted decision model): fast typed answers, no text generation.
- Rules fallback: deterministic, uses diff size, files touched, attempt count and test results.

The UI labels which backend answered. If Jev errors or times out, fall back automatically.

Example questions:

- ready\_to\_work (binary)
- needs\_more\_context (binary)
- touches\_sensitive\_paths: auth, payments, migrations, CI config (binary)
- failure\_type: assertion, build\_error, flaky, env, timeout (choice)
- next\_action: retry, retry\_with\_context, escalate, ask\_human, abandon (choice)
- model\_tier: fast, strong (choice)
- complexity\_risk (score)

State passed in is small: brief summary, last test result summary, diff stats, attempt count, file list. Keep each question to one judgment and combine answers in code with weights you control.

Honest note: Jev cannot write or call tools. It only decides. All generation stays with Gemini.

## 10. Coding agent design

- Runs in a fresh git worktree per run under the app data directory.
- Primary: Google Antigravity SDK (Python, local runtime, same agent runtime as the Antigravity CLI and IDE). It brings the agent loop plus file and shell tools. Restrict its tools and hook its events into the timeline. Fallback order: Codex SDK, then own tool loop on raw Gemini function calling (list\_dir, read\_file, grep, patch\_file, git\_diff) if the hour-0 spike fails.
- No unrestricted shell for the agent: disable or gate its shell tools. The verifier, not the agent, runs tests with a per-repo allowlisted command (for example pytest -x -q), a timeout and a stripped environment (no tokens).
- Tier routing: a fast Flash-class model by default, a stronger Pro-class model on escalation. Confirm exact model names available to your key.
- Agent adapter interface: run(task, workdir, on\_event) -> diff, summary, ok. Backends: AntigravityAgent (primary) and CodexAgent (second). Build the Codex adapter only after the first works end to end, capped at 90 minutes. Check the Codex SDK's runtime (Python or TypeScript, CLI wrapper or not) and its auth before planning around it. A dropdown in the UI switches backends, which makes the agent-agnostic claim a live demo. One agent run per worktree at a time. The verifier stays outside both agents.

Agent panel: a panel scoped to the current incident or issue that streams the agent's live events (files read, edits, test runs) and has a text box for follow-up instructions, such as 'add a null check instead of changing the schema'. A follow-up re-runs the agent on the same worktree and doubles as the reject-with-feedback flow. Budget 1 to 2 hours. It is not a general coding assistant.

## 11. Data model (SQLite)

- repos(id, owner, name, local\_path, test\_cmd)
- issues(id, repo\_id, number, title, body, state, updated\_at)
- comments(id, issue\_id, author, body, created\_at, is\_agent)
- briefs(id, issue\_id, json, ready, created\_at)
- runs(id, issue\_id, state, attempts, tier, started\_at, ended\_at)
- run\_events(id, run\_id, ts, stage, kind, payload)
- artifacts(id, run\_id, kind, path) for diffs, test logs
- decisions(id, run\_id, backend, questions\_json, answers\_json, action)
- approvals(id, run\_id, decision, reason, ts)

## 12. UI Screens & Visual Design System (GitHub Copilot Linux Clone)

The UI strictly adheres to the official GitHub Copilot Desktop App on Linux aesthetic. No AI SaaS gimmicks, glowing purple neon borders, or glassmorphic blur. Clean, matte, professional developer ergonomics.

### Design System Tokens
- **Canvas Base**: `#0d1117` (GitHub main dark)
- **Deep Background**: `#010409` (Titlebars, dark recesses)
- **Surfaces / Sidebars / Cards**: `#161b22`
- **Borders & Dividers**: `1px solid #30363d` (subtle separators `#21262d`)
- **Typography**: `-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif`
- **Monospace**: `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`
- **Text Hierarchy**: Primary `#c9d1d9` / `#f0f6fc`, Secondary `#8b949e`, Muted `#484f58`
- **Action / Primary Button**: GitHub Green `#238636` (hover `#2ea043`), text `#ffffff`, border `1px solid rgba(240, 246, 252, 0.1)`
- **Selected Navigation State**: Subtle border highlight `#388bfd` / `#1f6feb` or `#21262d` surface
- **Branch / PR Accent**: Subtle purple `#a371f7`

### Layout Architecture
```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Window Header: [ 🗖 ]  ProdPilot (GitHub Copilot Clone)                                     │
├──────────────┬──────────────────────────────────────────────────────────────┬───────────────┤
│ Left Sidebar │ Center Active Workspace                                      │ Right Drawer  │
│              │                                                              │               │
│ • [+ New]    │ Header: [FEATURE] Fix discount KeyError  [>_] [VS] [CreatePR]│ [+] [⛶]       │
│ • PRs        ├──────────────────────────────────────────────────────────────┤ • Changes     │
│ • Issues     │ Stream:                                                      │ • Terminal    │
│ • Automations│  $ pytest tests/test_orders.py                               │ • Browser     │
│ • Customize  │  >_ Read shell output (collapsible)                          │ • Files       │
│ • Incidents  │  "The latest changes pass all tests..."                      │ • Side chat   │
│              │  💭 Thought for 1s (collapsible)                             │ • Insights    │
│ Sessions     │  > Run complete test suite and 2 other tool calls            │ • Canvas      │
│  📁 demo-prod│  ─────────────────────────────────────────────────────────── ├───────────────┤
│   • discount │  [Changes +3 -1]  [🟢 Issue #1]  [🟢 Canary 8001/8002]       │ Auto-cleanup  │
│              │  ─────────────────────────────────────────────────────────── │ helper card   │
│              │  Action Card:                                                │               │
│ Profile bar  │  Deploy Fix to Production?                                   │               │
│  [Avatar]    │  A. Deploy Fix (Port 8001) [Enter]   B. Deploy Rollback      │               │
└──────────────┴──────────────────────────────────────────────────────────────┴───────────────┘
```

### Core Views
1. **Chat / Session View (Copilot Core)**: Interactive coding stream with real-time thought bubbles (`💭 Thought for Xs`), collapsible tool execution accordions (`> Run test suite`), shell logs, git patch summaries, and repository trust/approval dialogs.
2. **Issues Split-View**: Left list of issues filtered by tabs (`Assigned to me`, `Created by me`, `Mentioning me`, `Done`), right panel with issue conversation thread, assignees, labels, and bottom markdown editor with formatting toolbar and `[Open session]` launcher.
3. **Automations View**: Automation hero card (`Set up automations`), grid of trigger cards (`Issue triage [Daily]`, `Changelog draft [Weekly]`, `Repo audit [Manual]`), and agent skills selector.
4. **Customize View**: MCP servers, plugins, and skills marketplace with search, category pills (`Plan`, `Build`, `Review`, `Test`, `Ship`), and editor's picks.
5. **Incidents View (ProdPilot Superpower)**: Live telemetry watcher, error traceback, git blame commit attribution, dual canary controls (`8001 Fix-Forward`, `8002 Rollback`), and markdown post-mortem reports.

## 13. Final tech stack

Keep: Electron + React + TypeScript (shell and UI), Python + FastAPI (backend, SSE), SQLite + filesystem, GitHub REST with a fine-grained PAT (Issues, Pull requests, Contents read/write; Actions and Metadata read), Google Antigravity SDK (raw Gemini function calling as fallback), Jev with a rules fallback, python-telegram-bot (optional).

Dropped, with reasons: LangGraph (a plain state machine is easier to debug), GraphQL (REST covers issue threads; real GitHub Discussions are GraphQL-only, so skip them), MCP (extra layer, no benefit here), webhooks (need a public URL), separate Diagnosis agent (merged), Electron packaging.

## 14. Security and safety

- Prompt injection: issue and comment text is untrusted input to an agent with write ability. Mitigations: agent only sees the worktree, no secrets in its environment, no network tools, allowlisted commands, draft PRs only, mandatory human approval, diff always shown before push.
- Tokens stay local, stored outside the repo, never sent to the agent.
- Fine-grained PAT scoped to the demo repo only.
- Isolation is a git worktree plus an allowlist. It is not a sandbox. Say so honestly; Docker isolation is roadmap.
- Telegram: only respond to the configured chat ID.

## 15. Innovation and uniqueness

Claim these, not 'nobody has done it':

- Readiness gate: decides whether a thread is actionable before spending an agent run.
- Reproduction-first proof: a fix is only accepted when a new test fails before and passes after, and nothing else breaks.
- Decide, don't just retry: a typed decision step (Jev or rules) routes retry, escalate or ask human, with visible probabilities.
- Cost-aware routing: cheap model first, strong model only when needed.
- Local-first unified workspace: thread, brief, run, evidence and approval in one place, with state on the user's machine.
- Agent-swappable design.

Compared with issue-to-PR agents (Copilot agent, Devin, Codex cloud, Sentry autofix): they focus on producing the patch. ProdPilot focuses on readiness, proof and the decision around the patch.

## 16. Usefulness and impact

- Saves agent runs and developer time by refusing unready tasks.
- Raises trust in AI changes by attaching evidence instead of just a diff.
- Cuts context-switching: thread, logs and action in one window.
- Fits solo developers and small teams who cannot afford a dedicated triage process.
- Keeps humans in control, which is what teams actually need before adopting agents.

## 17. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Scope too big | Core list in section 5 only; cut order in section 18 |
| Agent flakiness during live demo | Seeded demo repo, recorded backup video, tested scenarios |
| Gemini rate limits | Check quotas hour 0, cache briefs, keep runs short |
| Jev payment or outage | Rules fallback behind the same interface |
| GitHub API quirks (CI logs) | Use local test output as the log if Actions logs are slow to wire |
| Electron glue time | Dev mode only, shell working by hour 2 or simplify |
| Venue wifi | Polling, local everything, phone hotspot as backup |
| Pre-built code accusation | Only the demo repo fixture is prepared in advance |

## 18. 24-hour build plan

| Hours | Work |
| --- | --- |
| 0-1 | Lock decisions, repo setup, demo repo with a real bug + messy thread, test Gemini function calling, confirm PAT works |
| 1-8 | Backend pipeline from CLI end to end: sync, brief, repro test, fix, verify, retry. No UI yet |
| 8-14 | Electron + React: inbox, issue view, run view, SSE timeline, approve / reject, draft PR |
| 14-18 | Decision layer (rules first, Jev on top), escalation, Telegram |
| 18-21 | Harden the demo path, scenario B and C, error states |
| 21-22 | Record backup demo video |
| 22-24 | Code freeze, rehearse, fix slide typos |

Cut order when behind: Telegram, extended features, scenario C, Jev (use fallback), UI polish. Never cut: readiness gate, repro-first test, verifier, approval gate, demo repo.

## 19. Demo plan (3 minutes)

1. Problem in one sentence (15 s).
2. Inbox: show issues with readiness badges (15 s).
3. Scenario B: vague issue gets blocked, clarifying comment drafted (30 s).
4. Scenario A: ready issue, live timeline, repro test fails, fix, tests pass, decision reasoning, approve, draft PR on GitHub (90 s).
5. Scenario C briefly, or the Telegram approval on a phone (20 s).
6. Close: what is unique, what is roadmap (10 s).

Backup: recorded video of the same flow, plus a pre-seeded finished run to open if the live agent stalls.

## 20. Hour-zero checklist

- [ ] Gemini key works; Antigravity SDK spike passes (edits a file in a worktree, events visible, shell restricted); Codex SDK spike only if Antigravity fails; rate limits known
- [ ] Jev key and payment sorted, or rules fallback accepted as the demo default
- [ ] Fine-grained PAT works on the demo repo (read issues, post comment, push branch, open draft PR)
- [ ] Optional second GitHub account for the bot identity
- [ ] Demo repo has a real failing behavior, a messy 6-8 comment thread, and a vague second issue
- [ ] Electron shell can spawn the backend
- [ ] Pitch slide typos fixed

## 21. Incident mode (hero path)

Incident mode is the headline demo: when a service fails, ProdPilot detects it, builds a verified fix and a verified rollback, stages both, pages the developer, and waits for one approval.

Pitch line: others stop at a pull request. ProdPilot stops one step later, restart-ready.

1. Detect: a watcher polls the service health URL every 5 s and watches the process and error log. Failure opens an incident.
2. Capture: stack trace, last 200 log lines, failing request (if logged), last 5 commits, and the suspect commit (blame on the traceback lines, with time since that commit).
3. Brief: the Context step turns the capture into a short incident brief (what failed, since when, likely area).
4. Reproduce: the agent turns the failing request or trace into a failing test. The verifier confirms it fails on the current code.
5. Fix and verify: the agent patches in a git worktree. The verifier runs the repro test plus the full suite. Same loop and retry limits as sections 8 and 10.
6. Stage two options: (a) fix-forward, the patched build started on a side port and health-checked; (b) rollback, the suspect commit reverted, tested, and also started on a side port and health-checked.
7. Decide: the decision layer recommends fix-forward or rollback with probabilities and a one-line reason.
8. Notify: Telegram message with the diagnosis, evidence and buttons Deploy fix, Rollback, Open app. If there is no acknowledgment after N minutes, place a phone call (extended feature).
9. Deploy on approval: swap the staged build into production and restart through the deploy adapter.
10. After deploy: health check. If it fails, auto-rollback to the previous build. Write an incident report (timeline, root cause, evidence, what was approved and by whom).

Safety rules: the agent never touches production, only staging directories and worktrees. Deploy is human-triggered only. Every action is written to an audit log. One incident is handled at a time. Verification comes from tests and health checks, never from the model's own opinion.

## 22. Incident mode features

| Feature | Priority | Done when |
| --- | --- | --- |
| Health and process watcher | Must | Killing the demo service opens an incident within 10 s |
| Incident capture with suspect commit | Must | Brief shows trace, logs, suspect commit and minutes since it landed |
| Repro test from the failing request | Must | Test fails before the fix, passes after |
| Staged fix-forward with canary health check | Must | Patched build answers its health URL on a side port |
| Staged rollback option | Must | Reverted build passes tests and health check |
| Recommendation with probabilities | Must | UI and Telegram show choice, probabilities and reason (rules backend is fine) |
| Telegram notify with Deploy and Rollback buttons | Must | Tap on phone restores the service |
| Deploy adapter for a local process with auto-rollback | Must | Failed health check after deploy triggers rollback |
| Incident report | Must | Markdown report saved and shown in the app |
| Paging ladder with Twilio call | Extended | Unacknowledged incident places a call to a verified number |
| Docker and systemd adapters | Roadmap | Not built, shown as the adapter interface |
| OpenTelemetry or APM ingestion | Roadmap | Not built |

## 23. Positioning against AI SRE tools

AI SRE agents already exist. From search snippets (not fully verified), [Middleware OpsAI](https://middleware.io/blog/how-we-built-an-ai-sre-agent-for-production-incidents/) detects, diagnoses and opens GitHub PR fixes, [Baz](https://baz.co/resources/sre-agent-baz-listens-to-production-and-opens-the-fix-pr-for-you) maps production traces to code and opens fix PRs, [Splunk](https://www.splunk.com/en_us/blog/observability/ai-sre-in-splunk-observability-cloud-can-remediate-incidents-with-claude-managed-agents.html) is adding code-level remediation, and a May 2026 hackathon project, [AXIOM](https://lablab.ai/submissions/x2tstcgxrgjq08yqtk4t65us), claims alert-to-verified-PR in under 90 seconds. Do not compete on speed to a PR.

Compete on the last mile. Most of these end at a PR or a suggestion, and several sit on top of an observability platform. Spend ten minutes re-checking their docs before claiming any difference on stage.

Pitch wording: unlike AI SRE tools that investigate or open a PR, ProdPilot delivers a staged, health-checked fix and a staged rollback, and waits for one approval.

What to emphasize:

- Fix-forward vs rollback as two ready options, with a typed recommendation.
- The production failure becomes the regression test.
- Suspect-commit detection from the traceback and git history.
- Works from a health check, logs and git, so a small team or student project needs no Datadog.
- Local-first: state and keys stay on the developer's machine.
- Telegram control and a paging ladder.
- Independent verification: tests and health checks decide, not the model.

## 24. Updated build order (replaces section 18)

| Hours | Work |
| --- | --- |
| 0-1 | Lock decisions. Demo service with a planted bug, in its own repo. Run the Antigravity SDK spike (Codex SDK if it fails), check PAT, Telegram bot token (BotFather) |
| 1-7 | CLI pipeline: incident to brief to repro test to fix to verify. No UI |
| 7-11 | Staging: side-port canary, rollback option, deploy adapter, auto-rollback |
| 11-15 | Telegram notify and buttons, decision recommendation (rules first, Jev on top) |
| 15-20 | Electron UI: incident view, live timeline, diff, evidence, Deploy and Rollback; read-only issue list and comment box; agent panel with follow-up box |
| 20-22 | Harden the demo, record backup video, Twilio call only if everything else is stable |
| 22-24 | Code freeze, rehearse |

Cut order when behind: Twilio call, issue-mode extras, Jev (use fallback), UI polish. Never cut: repro test, verifier, rollback option, approval gate, Telegram.

Demo (3 min): show the healthy service, kill it, phone buzzes with the diagnosis and evidence, show the two staged options and the recommendation, tap Deploy fix, service is back, show the incident report. Backup: recorded video of the same run.

## 25. Deployment model: the remote developer

The product vision is an always-on remote developer: an agent that runs on a server next to production and works while the developer sleeps. For the hackathon, ProdPilot runs as a local background daemon that is built to be deployed to a server. Build level 1 for sure; levels 2 and 3 are optional.

| Level | What you do | Effort | What you can honestly say |
| --- | --- | --- | --- |
| 1. Server-ready design | Headless backend, one config per project (repo path, test command, health URL, restart command), token-protected API, deploy adapter interface with only the local-process version | Almost free, it is how the code is structured | Built to run as a server daemon |
| 2. Container proof | One Dockerfile or docker-compose that starts the backend and the demo service | 1-2 hours, only at hour 20 if the core is stable | The same image runs on any VM |
| 3. Real cloud run | That container on a cloud VM, one incident run end to end | 2+ hours, skip unless ahead | We ran it on a server |

Rules for level 1:

- The backend must keep working with the Electron window closed. No pipeline logic in Electron.
- All project settings live in a project profile (config), so many projects later means many profiles.
- The deploy adapter is an interface. Only the local-process version is built; Docker and Kubernetes are future implementations.
- If the API is ever reachable beyond localhost, it needs a token and HTTPS or a tunnel (SSH or Tailscale). Never expose an unauthenticated agent API.
- Not verified: whether the Antigravity SDK runs well inside a container or on a Linux server. Test it before promising level 2 or 3.

Hosted vision (roadmap, not built): one control plane daemon, plus one isolated workspace container per monitored project (repo checkout, agent, test runner), created on demand and destroyed after each run. Agent-generated code never runs on a machine that holds secrets.

Demo that proves the point without a server: close the dashboard, crash the demo service, and the phone gets the Telegram diagnosis. Approve from the phone and the service comes back. The backend did everything with nobody at the keyboard.

Honest claims:

- Say: the demo production is a staged service we crash on purpose.
- Say: it runs as a local daemon today and is built for server deployment.
- Say deployed in the cloud only if level 3 was done.
- Do not claim multi-tenant, per-project containers or Kubernetes support. Show them as roadmap.
- If asked whether it runs in the cloud: the architecture is ready, the demo runs locally, and the container is the next step.

Path to production slide (four bullets): server mode, per-project containers, GitHub App identity, Docker and Kubernetes adapters.
