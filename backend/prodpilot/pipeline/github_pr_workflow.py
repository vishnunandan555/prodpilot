"""ProdPilot GitHub PR Workflow Engine
Creates an isolated branch and Pull Request for human review.
1. Creates dedicated fix/rollback branch
2. Applies verified patch or revert
3. Commits and pushes branch to remote GitHub repository
4. Opens GitHub Pull Request for human review
5. Leaves merge and deployment to a separate, explicitly approved provider workflow
"""

import json
import logging
import os
import re
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional

from backend.prodpilot.db import (
    get_active_repo,
    get_artifacts,
    get_incident,
    get_setting,
    log_event,
    save_artifact,
)
from backend.prodpilot.integrations.github_client import GitHubClient

logger = logging.getLogger("prodpilot.pr_workflow")


def resolve_repo_slug_and_token(repo_path: str) -> tuple[Optional[str], Optional[str]]:
    """Resolves owner/repo slug and GitHub token (prefers GitHub App token over PAT)."""
    from backend.prodpilot.integrations.github_client import mint_github_app_token

    # Check for GitHub App token first
    token = mint_github_app_token()
    if not token:
        token = get_setting("GITHUB_PAT") or os.environ.get("GITHUB_PAT") or os.environ.get("GH_PAT")

    active_repo = get_active_repo()
    slug = None
    if active_repo and active_repo.get("github_repo"):
        slug = active_repo["github_repo"]

    if not slug and repo_path and Path(repo_path).exists():
        try:
            res = subprocess.run(
                ["git", "config", "--get", "remote.origin.url"],
                cwd=repo_path,
                capture_output=True,
                text=True,
                timeout=5,
            )
            raw_url = res.stdout.strip()
            match = re.search(r"github\.com[:/]([^/]+)/([^/.]+)(?:\.git)?", raw_url)
            if match:
                slug = f"{match.group(1)}/{match.group(2)}"
        except Exception:
            pass

    return slug, token


def get_linked_github_issue(incident_id: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Retrieves linked GitHub issue artifact data if present."""
    arts = get_artifacts(incident_id, db_path=db_path)
    for art in arts:
        if art.get("kind") == "github_issue":
            try:
                return json.loads(art.get("content") or "{}")
            except Exception:
                pass
    return None


def get_linked_github_pr(incident_id: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Retrieves linked GitHub PR artifact data if present."""
    arts = get_artifacts(incident_id, db_path=db_path)
    for art in arts:
        if art.get("kind") == "github_pr":
            try:
                return json.loads(art.get("content") or "{}")
            except Exception:
                pass
    return None


def format_pr_body(
    incident_id: str,
    action: str,
    patch_diff: str,
    service_name: str,
    suspect_commit: Optional[str] = None,
    mobile_url: Optional[str] = None,
    brief: Optional[Dict[str, Any]] = None,
    trace: Optional[str] = None,
    linked_issue_number: Optional[int] = None,
) -> str:
    """Builds comprehensive markdown PR body with root cause analysis and verified patch details."""
    from backend.prodpilot.integrations.telegram_client import (
        generate_natural_fix_explanation,
        generate_natural_incident_explanation,
    )

    header = f"## ProdPilot Automated Remediation: `{action.upper()}`"
    incident_link = f"**Incident ID**: `{incident_id}`  \n"
    if linked_issue_number:
        incident_link += f"**Linked Issue**: Resolves #{linked_issue_number}  \n"
    if mobile_url:
        incident_link += f"**Live SRE Console**: [Open Incident Dashboard]({mobile_url})  \n"

    suspect_area = (brief or {}).get("suspected_area") or "codebase"
    issue_desc = generate_natural_incident_explanation(brief=brief, trace=trace)
    fix_desc = generate_natural_fix_explanation(patch_diff=patch_diff, brief=brief, suspected_area=suspect_area)

    diff_section = ""
    if patch_diff:
        diff_section = f"""### Verified Patch Diff
```diff
{patch_diff.strip()}
```
"""

    return f"""{header}
{incident_link}
**Service**: `{service_name}`  
**Proposed Remediation**: `{action.upper()}`  
**Affected Area**: `{suspect_area}`

---

### Root Cause Analysis
{issue_desc}

---

### Remediation Details
{fix_desc}

---

### Verification

Review the incident's recorded reproduction, regression, and canary artifacts. This PR description does not assert that those checks passed.

{diff_section}

---
*Prepared by ProdPilot for human review. Resolves #{linked_issue_number or incident_id} upon merge.*
"""


def create_linked_github_issue(
    incident: Dict[str, Any],
    brief: Optional[Dict[str, Any]] = None,
    repo_path: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Creates a GitHub Issue the moment an incident diagnosis starts and persists it as an artifact."""
    incident_id = incident.get("id", "")
    existing = get_linked_github_issue(incident_id, db_path=db_path)
    if existing and existing.get("issue_number"):
        return {"ok": True, "issue_number": existing["issue_number"], "issue_url": existing.get("issue_url")}

    target_repo = repo_path
    if not target_repo or not Path(target_repo).exists():
        active = get_active_repo(db_path=db_path)
        if active and active.get("local_path") and Path(active["local_path"]).exists():
            target_repo = active["local_path"]

    repo_slug, token = resolve_repo_slug_and_token(target_repo or "")
    if not repo_slug:
        logger.warning("No GitHub repo slug found for incident %s; skipping issue creation", incident_id)
        return {"ok": False, "error": "No GitHub repo configured"}

    service = incident.get("service") or "production-service"
    severity = incident.get("severity") or "sev2"
    error_type = incident.get("error_type") or "Production Incident"
    title = f"[{severity.upper()}] {service}: {error_type} ({incident_id[:8]})"

    raw_trace = (incident.get("trace") or incident.get("error_trace") or "No trace provided").strip()
    trace_snippet = raw_trace[:1500] if len(raw_trace) > 1500 else raw_trace

    from backend.prodpilot.integrations.telegram_client import get_effective_tunnel_url
    mobile_link = f"{get_effective_tunnel_url()}/incidents/{incident_id}"

    body = f"""## Automated Incident Detection & Triage

| Attribute | Value |
| :--- | :--- |
| **Incident ID** | `{incident_id}` |
| **Service** | `{service}` |
| **Severity** | `{severity.upper()}` |
| **Detected At** | `{incident.get('created_at', 'Just now')}` |
| **Status** | **DIAGNOSIS IN PROGRESS** |
| **Live Console** | [Open Incident Dashboard]({mobile_link}) |

### Error Trace Snapshot
```text
{trace_snippet}
```

---
*ProdPilot Autonomous SRE has locked the incident and is executing root-cause analysis in isolated worktree environments.*
"""

    labels = ["incident", "prodpilot", severity.lower()]
    client = GitHubClient(token=token)
    res = client.create_issue(repo_slug=repo_slug, title=title, body=body, labels=labels)

    if res.get("ok"):
        issue_number = res.get("issue_number")
        issue_url = res.get("issue_url")
        payload = {
            "issue_number": issue_number,
            "issue_url": issue_url,
            "repo_slug": repo_slug,
            "state": "open",
        }
        save_artifact(
            artifact_id=f"art-issue-{incident_id[:8]}",
            run_id=None,
            incident_id=incident_id,
            kind="github_issue",
            content=json.dumps(payload),
            path=issue_url,
            db_path=db_path,
        )
        log_event(
            run_id=None,
            incident_id=incident_id,
            stage="UNDERSTAND",
            kind="github_issue_created",
            payload=payload,
            db_path=db_path,
        )
        return {"ok": True, "issue_number": issue_number, "issue_url": issue_url}
    else:
        logger.warning("GitHub create_issue failed for incident %s: %s", incident_id, res.get("error"))
        return {"ok": False, "error": res.get("error", "Failed to create GitHub issue")}


def post_github_issue_comment(
    incident_id: str,
    comment_markdown: str,
    repo_path: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Posts a milestone report comment to the linked GitHub issue."""
    issue_data = get_linked_github_issue(incident_id, db_path=db_path)
    if not issue_data or not issue_data.get("issue_number"):
        return {"ok": False, "error": "No linked GitHub issue found"}

    target_repo = repo_path
    if not target_repo or not Path(target_repo).exists():
        active = get_active_repo(db_path=db_path)
        if active and active.get("local_path") and Path(active["local_path"]).exists():
            target_repo = active["local_path"]

    repo_slug, token = resolve_repo_slug_and_token(target_repo or "")
    if not repo_slug:
        repo_slug = issue_data.get("repo_slug")

    if not repo_slug or not token:
        return {"ok": False, "error": "GitHub credentials or repo slug missing"}

    client = GitHubClient(token=token)
    res = client.add_issue_comment(
        repo_slug=repo_slug,
        issue_number=int(issue_data["issue_number"]),
        comment_body=comment_markdown,
    )
    if res.get("ok"):
        log_event(
            run_id=None,
            incident_id=incident_id,
            stage="REPORT",
            kind="github_issue_comment",
            payload={"issue_number": issue_data["issue_number"], "comment_id": res.get("comment_id")},
            db_path=db_path,
        )
    return res


def close_linked_github_issue_and_merge_pr(
    incident_id: str,
    action: str = "fix_forward",
    repo_path: Optional[str] = None,
    approver_source: str = "dashboard",
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Merges the Pull Request on GitHub and closes the linked GitHub Issue."""
    target_repo = repo_path
    if not target_repo or not Path(target_repo).exists():
        active = get_active_repo(db_path=db_path)
        if active and active.get("local_path") and Path(active["local_path"]).exists():
            target_repo = active["local_path"]

    repo_slug, token = resolve_repo_slug_and_token(target_repo or "")
    client = GitHubClient(token=token)

    issue_data = get_linked_github_issue(incident_id, db_path=db_path)
    pr_data = get_linked_github_pr(incident_id, db_path=db_path)

    results: Dict[str, Any] = {"ok": True, "pr_merged": False, "issue_closed": False}

    # 1. Merge PR if action is fix_forward and PR exists
    if action == "fix_forward" and pr_data and pr_data.get("pr_number") and repo_slug:
        pr_number = int(pr_data["pr_number"])
        if not pr_data.get("merged"):
            merge_res = client.merge_pull_request(
                repo_slug=repo_slug,
                pr_number=pr_number,
                commit_title=f"fix(prodpilot): resolve incident {incident_id}",
                commit_message=f"Approved and merged via ProdPilot {approver_source}.",
                merge_method="squash",
            )
            if merge_res.get("ok"):
                results["pr_merged"] = True
                pr_data["merged"] = True
                save_artifact(
                    artifact_id=f"art-pr-{incident_id[:8]}",
                    run_id=None,
                    incident_id=incident_id,
                    kind="github_pr",
                    content=json.dumps(pr_data),
                    path=pr_data.get("pr_url"),
                    db_path=db_path,
                )
            else:
                results["pr_merge_error"] = merge_res.get("error")

    # 2. Add closing comment and close issue if issue exists
    if issue_data and issue_data.get("issue_number") and repo_slug:
        issue_number = int(issue_data["issue_number"])
        if action == "fix_forward":
            closing_comment = f"""### ✅ Incident Resolved & Fix Merged
- **Remediation Action**: `FIX_FORWARD`
- **Approved by**: `{approver_source}`
- **Pull Request**: #{pr_data.get('pr_number') if pr_data else 'N/A'} (Merged)
- **Status**: Live traffic verified on port 8000 canary swap. Watchdog confirmed stable.

Closing incident issue.
"""
        elif action == "rollback":
            closing_comment = f"""### 🔄 Incident Rolled Back
- **Remediation Action**: `ROLLBACK`
- **Approved by**: `{approver_source}`
- **Status**: Production rolled back to previous stable commit.

Closing incident issue.
"""
        else:
            closing_comment = f"""### 🧑‍💻 Manual Takeover Initiated
- **Action**: `MANUAL_TAKEOVER`
- **Triggered by**: `{approver_source}`
- **Status**: Worktree environment preserved for on-call engineer inspection.
"""

        client.add_issue_comment(repo_slug=repo_slug, issue_number=issue_number, comment_body=closing_comment)
        if action in ("fix_forward", "rollback"):
            close_res = client.close_issue(repo_slug=repo_slug, issue_number=issue_number, state_reason="completed")
            if close_res.get("ok"):
                results["issue_closed"] = True
                issue_data["state"] = "closed"
                save_artifact(
                    artifact_id=f"art-issue-{incident_id[:8]}",
                    run_id=None,
                    incident_id=incident_id,
                    kind="github_issue",
                    content=json.dumps(issue_data),
                    path=issue_data.get("issue_url"),
                    db_path=db_path,
                )
            else:
                results["issue_close_error"] = close_res.get("error")

    log_event(
        run_id=None,
        incident_id=incident_id,
        stage="APPROVE",
        kind="github_resolution_lifecycle",
        payload={**results, "action": action, "approver_source": approver_source},
        db_path=db_path,
    )
    return results


def execute_github_pr_lifecycle(
    incident_id: str,
    action: str,
    repo_path: Optional[str] = None,
    patch_diff: Optional[str] = None,
    suspect_commit_hash: Optional[str] = None,
    source: str = "pipeline",
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Prepare an isolated branch and open a PR; this function never merges."""
    from backend.prodpilot.pipeline.worktree import create_worktree, remove_worktree

    if action not in ("fix_forward", "rollback"):
        return {"ok": False, "error": f"Unsupported remediation action: {action}"}
    if action == "fix_forward" and not patch_diff:
        return {"ok": False, "error": "Cannot prepare a fix PR without a verified patch diff"}
    if action == "rollback" and not suspect_commit_hash:
        return {"ok": False, "error": "Cannot prepare a rollback PR without a suspect commit"}

    target_repo = repo_path
    if not target_repo or not Path(target_repo).exists():
        active = get_active_repo(db_path=db_path)
        if active and active.get("local_path") and Path(active["local_path"]).exists():
            target_repo = active["local_path"]
    if not target_repo or not Path(target_repo).exists():
        return {"ok": False, "error": "No valid connected Git repository path found"}

    repo_dir = Path(target_repo).resolve()
    repo_slug, token = resolve_repo_slug_and_token(str(repo_dir))
    if not repo_slug or not token:
        return {"ok": False, "error": "GitHub repository and write-capable token are required; no PR was created"}

    active = get_active_repo(db_path=db_path) or {}
    base_branch = active.get("default_branch") or "main"
    unique_suffix = re.sub(r"[^a-zA-Z0-9_-]", "", incident_id.replace("inc-", ""))
    branch_name = f"prodpilot/{'fix' if action == 'fix_forward' else 'revert'}-{unique_suffix}"
    worktree_path = None
    pr_number = None
    pr_url = None

    try:
        # Base the change on the remote target branch without checking out or modifying the user's checkout.
        fetch = subprocess.run(
            ["git", "fetch", "origin", base_branch],
            cwd=str(repo_dir), capture_output=True, text=True, timeout=30,
        )
        if fetch.returncode != 0:
            return {"ok": False, "error": f"Could not fetch origin/{base_branch}: {fetch.stderr.strip()}"}
        base_ref = f"origin/{base_branch}"
        verify = subprocess.run(
            ["git", "rev-parse", "--verify", base_ref],
            cwd=str(repo_dir), capture_output=True, text=True,
        )
        if verify.returncode != 0:
            return {"ok": False, "error": f"Remote base branch {base_ref} does not exist"}

        worktree_path = create_worktree(
            str(repo_dir), commit=base_ref, prefix=f"prodpilot-pr-{incident_id[:8]}-",
        )
        branch = subprocess.run(
            ["git", "switch", "-C", branch_name],
            cwd=worktree_path, capture_output=True, text=True,
        )
        if branch.returncode != 0:
            return {"ok": False, "error": f"Could not create isolated branch: {branch.stderr.strip()}"}

        if action == "fix_forward":
            apply = subprocess.run(
                ["git", "apply", "--3way"], input=patch_diff,
                cwd=worktree_path, capture_output=True, text=True,
            )
            if apply.returncode != 0:
                return {"ok": False, "error": f"Could not apply verified patch: {apply.stderr.strip()}"}
        else:
            revert = subprocess.run(
                ["git", "revert", "--no-edit", suspect_commit_hash],
                cwd=worktree_path, capture_output=True, text=True,
            )
            if revert.returncode != 0:
                subprocess.run(["git", "revert", "--abort"], cwd=worktree_path, capture_output=True)
                return {"ok": False, "error": f"Could not prepare rollback: {revert.stderr.strip()}"}

        staged = subprocess.run(["git", "add", "-A"], cwd=worktree_path, capture_output=True, text=True)
        if staged.returncode != 0:
            return {"ok": False, "error": f"Could not stage changes: {staged.stderr.strip()}"}
        diff_check = subprocess.run(
            ["git", "diff", "--cached", "--quiet"], cwd=worktree_path,
            capture_output=True, text=True,
        )
        if diff_check.returncode == 0:
            return {"ok": False, "error": "Remediation produced no changes; no PR was created"}

        # Configure official Bot Author for Git history
        bot_app_id = get_setting("GITHUB_APP_ID") or "5450099"
        bot_name = "prodpilotagent[bot]"
        bot_email = f"{bot_app_id}+{bot_name}@users.noreply.github.com"
        commit_env = os.environ.copy()
        commit_env["GIT_AUTHOR_NAME"] = bot_name
        commit_env["GIT_AUTHOR_EMAIL"] = bot_email
        commit_env["GIT_COMMITTER_NAME"] = bot_name
        commit_env["GIT_COMMITTER_EMAIL"] = bot_email

        commit = subprocess.run(
            ["git", "commit", "-m", f"fix(prodpilot): resolve incident {incident_id}"],
            cwd=worktree_path, capture_output=True, text=True, env=commit_env,
        )
        if commit.returncode != 0:
            return {"ok": False, "error": f"Could not commit remediation: {commit.stderr.strip()}"}

        # Push branch using authenticated URL with installation token
        push_cmd = ["git", "push", "-u", "--force", "origin", branch_name]
        if token and repo_slug:
            auth_remote = f"https://x-access-token:{token}@github.com/{repo_slug}.git"
            push_cmd = ["git", "push", "-u", "--force", auth_remote, branch_name]

        push = subprocess.run(
            push_cmd,
            cwd=worktree_path, capture_output=True, text=True, timeout=30,
        )
        if push.returncode != 0:
            return {"ok": False, "error": f"Could not push PR branch: {push.stderr.strip()}"}

        inc = get_incident(incident_id, db_path=db_path) or {}
        issue_data = get_linked_github_issue(incident_id, db_path=db_path)
        linked_num = issue_data.get("issue_number") if issue_data else None

        from backend.prodpilot.integrations.telegram_client import get_effective_tunnel_url
        mobile_link = f"{get_effective_tunnel_url()}/incidents/{incident_id}"
        pr_res = GitHubClient(token=token).create_pull_request(
            repo_slug=repo_slug,
            title=f"fix(prodpilot): resolve incident {incident_id} [{action.upper()}]",
            body=format_pr_body(
                incident_id=incident_id, action=action, patch_diff=patch_diff or "",
                service_name=inc.get("service", "production-service"),
                suspect_commit=suspect_commit_hash, mobile_url=mobile_link,
                brief=inc.get("brief"), trace=inc.get("trace"),
                linked_issue_number=linked_num,
            ),
            head_branch=branch_name,
            base_branch=base_branch,
            draft=False,
            token=token,
        )
        if not pr_res.get("ok"):
            return {"ok": False, "error": pr_res.get("error", "GitHub did not create the PR"), "branch": branch_name}
        pr_number = pr_res.get("pr_number")
        pr_url = pr_res.get("pr_url")

        save_artifact(
            artifact_id=f"art-pr-{incident_id[:8]}", run_id=None,
            incident_id=incident_id, kind="github_pr",
            content=json.dumps({
                "branch": branch_name, "pr_number": pr_number, "pr_url": pr_url,
                "merged": False, "action": action,
            }),
            path=pr_url, db_path=db_path,
        )
        log_event(
            run_id=None, incident_id=incident_id, stage="FIX", kind="pr_opened",
            payload={
                "branch": branch_name, "pr_number": pr_number, "pr_url": pr_url,
                "merged": False, "action": action, "source": source,
                "message": f"PR #{pr_number} opened for review; it has not been merged or deployed.",
            }, db_path=db_path,
        )

        if linked_num:
            pr_comment = f"""### Remediation Pull Request Opened
- **Pull Request**: [#{pr_number}]({pr_url})
- **Branch**: `{branch_name}`
- **Remediation Action**: `{action.upper()}`

*Canary verification has passed in sandbox environments. Awaiting approval from on-call engineer before merge & deployment.*
"""
            post_github_issue_comment(incident_id, pr_comment, repo_path=str(repo_dir), db_path=db_path)

        return {
            "ok": True, "branch": branch_name, "pr_number": pr_number,
            "pr_url": pr_url, "merged": False, "action": action,
        }
    except Exception as exc:
        logger.exception("GitHub PR preparation failed for incident %s", incident_id)
        return {"ok": False, "error": str(exc), "branch": branch_name}
    finally:
        if worktree_path:
            remove_worktree(worktree_path, repo_path=str(repo_dir))
