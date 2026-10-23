# ProdPilot - Build Plan

Realm Hack 2026 | 24-hour build window, 2 PM to 2 PM | Vishnu Nandan

Build in six phases with at most two parallel streams. Each phase ends at a gate; do not start the next phase until the gate passes. The demo floor is Gate 2: crash the service, tap Deploy on your phone, the service is healthy again. Everything after Gate 2 is a bonus.

## 1. Phase overview

| Phase | Hours | Goal | Gate |
| --- | --- | --- | --- |
| 0. Setup and spikes | 0-2 | Agent SDK works, Telegram bot talks, demo service ready, contracts frozen | Gate 0 |
| 1. Core pipeline | 2-8 | Crash becomes an incident, then a verified fix, from the command line | Gate 1 |
| 2. Staging, decisions, Telegram | 8-14 | Phone approval restores the service | Gate 2 (demo floor) |
| 3. Dashboard | 14-19 | The desktop UI drives the same flow | Gate 3 |
| 4. Harden and one extra | 19-22 | Three clean runs in a row | Gate 4 |
| 5. Freeze and pitch | 22-24 | Backup video, slides, rehearsal | Done |

The hour numbers are blocks, not deadlines to watch. Move on when the gate passes.

## 2. Rules of the build

- Two streams at most. Stream A is the Brain (backend pipeline, agent, verifier, staging, decisions). Stream B is the Body (demo service, watcher, Telegram, desktop UI).
- One owner per folder. If a task needs a file owned by the other stream, ask the owner stream to add it.
- Contracts first. Interfaces are written in Phase 0 and changed only on main.
- Merge only at gates. Everything else stays on the stream branch.
- Build everything inside the window, including the demo service. The proposal says the project is built during the hackathon, not before.
- Keep code simple. Write tests for pipeline modules only, not for UI.
- The verifier is deterministic: tests and health checks decide, never the agent.
- Never cut: repro test, verifier, rollback option, approval gate, Telegram.

## 3. Repo and folder layout

```
prodpilot/                 main repo
  contracts/               frozen interfaces (edit on main only)
  backend/prodpilot/
    db.py                  Stream A (created in Phase 0, then frozen)
    pipeline/              Stream A
    agents/                Stream A (Antigravity adapter, later Codex)
    staging/               Stream A (fix-forward, rollback, deploy adapter)
    decide/                Stream A (rules, Jev)
    api/                   Stream A (FastAPI, SSE)
    watcher/               Stream B
    telegram/              Stream B
  desktop/                 Stream B (Electron + React)
  scripts/                 Stream B (reset-demo, trigger-crash)
demo-prod/                 separate git repo: the fake production service
```

Why demo-prod is its own repo: the agent works on it with worktrees, and a real commit history gives you a real suspect commit.

Git setup, done once in Phase 0:

- main holds contracts and merges only.
- Two worktrees: `git worktree add ../prodpilot-a stream-a` and `git worktree add ../prodpilot-b stream-b`.
- At each gate: Stream A merges to main, Stream B rebases onto main and merges, then you run the whole flow on main and tag it.

Contracts to write in Phase 0 (all in contracts/):

- schema.sql: tables for repos, incidents, runs, run\_events, artifacts, decisions, approvals.
- incident.example.json: id, service, detected\_at, trace, log\_tail, recent\_commits, suspect\_commit.
- events.md: event kinds streamed to the UI (incident\_opened, stage\_started, tool\_call, test\_result, decision, awaiting\_approval, deployed, rolled\_back).
- api.md: GET /incidents, GET /incidents/{id}, GET /incidents/{id}/events (SSE), POST /incidents/{id}/approve with option fix or rollback, POST /incidents/{id}/reject with reason, POST /incidents/{id}/followup with text.
- project.profile.example.yaml: name, repo\_path, test\_cmd, health\_url, start\_cmd, port.
- Agent adapter signature: run(task, workdir, on\_event) -> diff, summary, ok.

## 4. Accounts and build assistants

| Account | Use during the build | Note |
| --- | --- | --- |
| Codex | Build assistant for Stream A (Python backend, pipeline, tests) | Swap if it underperforms |
| Google Pro #1 | Build assistant for Stream B (UI, Telegram, demo service) using Antigravity | Swap if it underperforms |
| Google Pro #2 | Reserve: runtime agent runs and demo rehearsals | Keeps build usage from draining your demo quota |

- A Google Pro subscription is not the same as Gemini API quota. ProdPilot's runtime uses a Gemini API key with the Antigravity SDK, so check that key's limits in Phase 0.
- These assistants build ProdPilot. The Antigravity SDK is what ProdPilot itself runs at runtime.
- Put a short instructions file in each worktree root: the folder scope, the contracts to follow, keep code simple, run tests before finishing.
- Never run more than two agent sessions at once. When one finishes, review the diff, run it, commit, then hand it the next task.

## 5. Phase 0: setup and spikes (hours 0-2)

Goal: remove every unknown before building.

Stream A:

- [ ] Antigravity SDK spike (cap 45 min): pip install google-antigravity, run the quickstart, have it edit a file inside a git worktree, see its tool call events, restrict or gate the shell tool. If it fails: Codex SDK spike (30 min), then your own Gemini loop.
- [ ] Check Gemini API key limits. Try the Jev key; if payment fails, the rules backend is the default.
- [ ] Write contracts/ and db.py with helper functions, commit to main.

Stream B:

- [ ] Repo skeleton, branches and worktrees.
- [ ] demo-prod: a small web service (Flask or FastAPI) with an order total endpoint and 5-6 commits of real history. The last commit adds discount support and introduces a bug that fails when an order lacks a field. After an unhandled error, the health URL starts failing. Existing tests pass. Add a trigger script that sends the bad request.
- [ ] scripts/reset-demo restores the bug and restarts the service.
- [ ] Telegram: create the bot with BotFather, use python-telegram-bot with long polling, send a hello message with two inline buttons, accept only your own chat ID.
- [ ] Create a Twilio account and verify your phone number now (10 minutes), so the call extra is possible later.

Gate 0: the SDK edits a file in a worktree and you can see its events; a Telegram message with buttons reaches your phone and a button press reaches your code; demo-prod runs, crashes on the trigger, and resets; contracts are on main.

## 6. Phase 1: core pipeline (hours 2-8)

Goal: crash the service and get a verified fix from the command line, no UI.

Stream A:

- [ ] Worktree manager: create and destroy a worktree per incident.
- [ ] Agent adapter for the Antigravity SDK, following the contract signature.
- [ ] Context brief step: structured JSON (what failed, since when, suspect area).
- [ ] Repro-first fix: first prompt writes a failing test for the incident; the verifier confirms it fails on unmodified code; a second prompt fixes the code.
- [ ] Verifier: runs the repro test plus the full suite using the profile's test command, with a timeout and a stripped environment (no tokens).
- [ ] Retry loop: maximum 2 retries, failure logs fed back to the agent.
- [ ] CLI: run the pipeline on an incident JSON and print the evidence (test before and after, diff).

Stream B:

- [ ] First hour: write 2-3 incident.json fixtures so Stream A is never blocked waiting for the watcher.
- [ ] Watcher: poll the health URL every 5 s; two failures in a row opens an incident; also detect process exit.
- [ ] Incident capture: traceback from the service log, last 200 log lines, git log of the last 5 commits, git blame on the traceback lines to find the suspect commit and minutes since it landed.
- [ ] Save incidents through db.py.

Gate 1: kill demo-prod with the trigger, an incident is captured with a suspect commit, and the CLI pipeline produces a patch where the repro test fails before and passes after, plus the full suite is green.

## 7. Phase 2: staging, decisions, Telegram (hours 8-14)

Goal: a phone tap restores the service. This is the demo floor.

Stream A:

- [ ] Fix-forward staging: patched build in its own directory, started on a side port, health-checked.
- [ ] Rollback option: second worktree, git revert of the suspect commit without committing, run tests, start on another side port, health-check.
- [ ] Deploy adapter (local process): stop production, start the chosen build on the production port, health-check for 10 s, restore the previous build if it fails.
- [ ] Decision layer: decide(state, questions) with the rules backend first, recommending fix-forward or rollback with probabilities and a one-line reason. Add the Jev backend on top if the key works, with automatic fallback to rules.
- [ ] Incident report in markdown.
- [ ] API: approve, reject, get incident, minimal SSE events.

Stream B:

- [ ] Telegram notification: diagnosis, evidence summary, recommendation, and buttons Deploy fix, Rollback, Reject. A button calls the approve endpoint.
- [ ] Commands /status and /logs.
- [ ] Build against a mocked incident until Stream A's API is ready.
- [ ] Telegram messages for the deploy result and the report.

Gate 2: crash the service, your phone gets the message, tap Deploy fix, the service is healthy again, and the report is saved. Run it twice. If you are short on time after this gate, cut the dashboard down to one incident page.

## 8. Phase 3: dashboard (hours 14-19)

Goal: the desktop app drives the same flow.

Stream A:

- [ ] Stabilize the API and SSE event stream; load the project profile from config.
- [ ] Follow-up endpoint: re-run the agent on the same worktree with an extra instruction.
- [ ] Only if ahead: minimal issue mode (GitHub polling, issue list endpoint, comment posting).

Stream B:

- [ ] Electron shell in dev mode that spawns the backend.
- [ ] React screens: incident list; incident view with live timeline, diff viewer, test evidence before and after, decision card with probabilities, Deploy, Rollback and Reject buttons.
- [ ] Agent panel: live agent events and a follow-up text box.
- [ ] Read-only issues tab only if Stream A built the issue endpoint.

Gate 3: the UI and Telegram can both approve the same incident, and the backend keeps working with the Electron window closed.

## 9. Phase 4: harden and one extra (hours 19-22)

Goal: the demo survives repetition and something goes wrong on purpose.

Hardening (main stream):

- [ ] Run the full flow three times in a row using scripts/reset-demo.
- [ ] Error states: agent timeout, flaky test, health check failing after deploy (show the automatic rollback).
- [ ] Second scenario: the first fix attempt fails and the retry or escalation succeeds, using a second bug variant.
- [ ] Fix rough UI edges.

One extra at a time, in this order, only if hardening is done:

1. Phone call with Twilio if your number is already verified: a one-way call after N minutes without acknowledgment, message sent inline, no webhook. If it is not working in 45 minutes, show a clearly labeled simulated call.
2. docker-compose that starts the backend and demo service (container proof). Test that the Antigravity SDK runs inside the container before promising it.
3. Codex adapter (cap 90 minutes).
4. GitHub App identity.

Gate 4: three consecutive clean runs from reset, without touching the code in between.

## 10. Phase 5: freeze and pitch (hours 22-24)

- [ ] Code freeze and tag the demo version. No new features.
- [ ] Record a backup video of the full flow.
- [ ] Save one finished incident so you can open it if the live agent stalls.
- [ ] Fix the slides: positioning line (restart-ready, not PR-ready), path to production slide, honest claims, and typos.
- [ ] Rehearse the 3-minute demo twice.
- [ ] Final checks: phone charged, hotspot ready, API keys have quota, Telegram works, demo-prod reset, backend running with the dashboard closed.

## 11. If you are behind

Cut in this order:

1. Extras (call, container, Codex adapter, GitHub App).
2. Issue mode.
3. Jev (use the rules backend).
4. Agent panel follow-up box.
5. Dashboard polish, down to one incident page plus Telegram.

Never cut: repro test, verifier, rollback option, approval gate, Telegram.

## 12. Risks and fallbacks

| Risk | Fallback |
| --- | --- |
| Antigravity SDK fails the spike | Codex SDK, then your own Gemini loop behind the same adapter |
| API quota runs out | Switch to the Google Pro #2 key, reduce retries |
| Agent too slow in the live demo | Open the saved finished incident, or play the backup video |
| Jev payment or outage | Rules backend, already the default |
| Venue wifi blocks Telegram | Phone hotspot; approve from the dashboard instead |
| Merge conflicts | Folder ownership, contracts only on main, merge at gates |
| Demo flakiness | scripts/reset-demo and the backup video |

## 13. How to run two streams without overload

- One terminal or IDE window per worktree. No third window.
- Before handing an agent a task, write the task in two or three lines with its exit check (what command proves it works).
- When an agent finishes: read the diff, run the check, commit, then give the next task.
- Eat properly and take a short break about every 4 hours. If you are ahead after Gate 3, a 60-90 minute rest is worth more than another feature.
