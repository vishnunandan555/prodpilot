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
    """Resolves owner/repo slug and GitHub PAT."""
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


def format_pr_body(
    incident_id: str,
    action: str,
    patch_diff: str,
    service_name: str,
    suspect_commit: Optional[str] = None,
    mobile_url: Optional[str] = None,
    brief: Optional[Dict[str, Any]] = None,
    trace: Optional[str] = None,
) -> str:
    """Builds comprehensive markdown PR body with root cause analysis and verified patch details."""
    from backend.prodpilot.integrations.telegram_client import (
        generate_natural_fix_explanation,
        generate_natural_incident_explanation,
    )

    header = f"## 🤖 ProdPilot Automated Remediation: `{action.upper()}`"
    incident_link = f"**Incident ID**: `{incident_id}`  \n"
    if mobile_url:
        incident_link += f"**Live SRE Console**: [📱 Open Incident Dashboard]({mobile_url})  \n"

    suspect_area = (brief or {}).get("suspected_area") or "codebase"
    issue_desc = generate_natural_incident_explanation(brief=brief, trace=trace)
    fix_desc = generate_natural_fix_explanation(patch_diff=patch_diff, brief=brief, suspected_area=suspect_area)

    diff_section = ""
    if patch_diff:
        diff_section = f"""### 📝 Verified Patch Diff
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

### 💥 What Happened (Root Cause)
{issue_desc}

---

### 🔧 What is the Fix & How it Works
{fix_desc}

---

### Verification

Review the incident's recorded reproduction, regression, and canary artifacts. This PR description does not assert that those checks passed.

{diff_section}

---
*Prepared by ProdPilot for human review. This PR has not been merged or deployed.*
"""


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
    branch_name = f"prodpilot/{'fix' if action == 'fix_forward' else 'revert'}-{incident_id[:8]}"
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
            ["git", "switch", "-c", branch_name],
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
        commit = subprocess.run(
            ["git", "commit", "-m", f"fix(prodpilot): resolve incident {incident_id}"],
            cwd=worktree_path, capture_output=True, text=True,
        )
        if commit.returncode != 0:
            return {"ok": False, "error": f"Could not commit remediation: {commit.stderr.strip()}"}

        push = subprocess.run(
            ["git", "push", "-u", "origin", branch_name],
            cwd=worktree_path, capture_output=True, text=True, timeout=30,
        )
        if push.returncode != 0:
            return {"ok": False, "error": f"Could not push PR branch: {push.stderr.strip()}"}

        inc = get_incident(incident_id, db_path=db_path) or {}
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
