"""ProdPilot GitHub REST API Client
Provides authenticated access to GitHub API (https://api.github.com)
for fetching live repository issues, pull requests, actions/deployment logs,
commit trees, and validating local git repositories.
"""

import logging
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger(__name__)

GITHUB_API_BASE = "https://api.github.com"


class GitHubClient:
    def __init__(self, token: Optional[str] = None):
        self.token = (token or "").strip()

    def _headers(self, custom_token: Optional[str] = None) -> Dict[str, str]:
        t = (custom_token or self.token or "").strip()
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "ProdPilot-Autonomous-SRE/1.0",
        }
        if t:
            headers["Authorization"] = f"Bearer {t}"
        return headers

    @staticmethod
    def normalize_slug(repo_input: str) -> str:
        """Extracts 'owner/repo' from URLs or raw strings."""
        s = repo_input.strip()
        s = s.replace("https://github.com/", "").replace("http://github.com/", "")
        s = s.rstrip("/").removesuffix(".git")
        return s

    def get_repo(self, repo_slug: str, token: Optional[str] = None) -> Dict[str, Any]:
        slug = self.normalize_slug(repo_slug)
        url = f"{GITHUB_API_BASE}/repos/{slug}"
        headers = self._headers(token)

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    return {
                        "ok": True,
                        "repo": {
                            "name": data.get("name", slug.split("/")[-1]),
                            "full_name": data.get("full_name", slug),
                            "description": data.get("description", ""),
                            "default_branch": data.get("default_branch", "main"),
                            "open_issues_count": data.get("open_issues_count", 0),
                            "stars": data.get("stargazers_count", 0),
                            "is_private": data.get("private", False),
                            "html_url": data.get("html_url", f"https://github.com/{slug}"),
                        },
                    }
                elif res.status_code == 401:
                    return {"ok": False, "error": "Invalid GitHub PAT (401 Unauthorized)", "repo": None}
                elif res.status_code == 404:
                    return {"ok": False, "error": f"Repository '{slug}' not found on GitHub (or PAT lacks repo scope)", "repo": None}
                else:
                    return {"ok": False, "error": f"GitHub API error {res.status_code}: {res.text[:150]}", "repo": None}
        except Exception as e:
            return {"ok": False, "error": str(e), "repo": None}

    def get_issues(self, repo_slug: str, token: Optional[str] = None, state: str = "open", limit: int = 30) -> Dict[str, Any]:
        """Fetches issues for repository (excluding pull requests)."""
        slug = self.normalize_slug(repo_slug)
        url = f"{GITHUB_API_BASE}/repos/{slug}/issues?state={state}&per_page={limit}"
        headers = self._headers(token)

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    raw_items = res.json()
                    issues = []
                    for item in raw_items:
                        # GitHub issues endpoint includes pull requests if 'pull_request' key is present
                        if "pull_request" in item:
                            continue
                        issues.append({
                            "id": str(item.get("id")),
                            "number": item.get("number"),
                            "title": item.get("title", "Untitled Issue"),
                            "body": item.get("body") or "",
                            "state": item.get("state", "open").upper(),
                            "author": (item.get("user") or {}).get("login", "unknown"),
                            "labels": [lbl.get("name") for lbl in item.get("labels", []) if isinstance(lbl, dict)],
                            "comments_count": item.get("comments", 0),
                            "created_at": item.get("created_at", ""),
                            "html_url": item.get("html_url", ""),
                        })
                    return {"ok": True, "issues": issues, "count": len(issues)}
                return {"ok": False, "error": f"GitHub API error {res.status_code}", "issues": []}
        except Exception as e:
            return {"ok": False, "error": str(e), "issues": []}

    def get_pull_requests(self, repo_slug: str, token: Optional[str] = None, state: str = "all", limit: int = 20) -> Dict[str, Any]:
        """Fetches pull requests and discussions from repository."""
        slug = self.normalize_slug(repo_slug)
        url = f"{GITHUB_API_BASE}/repos/{slug}/pulls?state={state}&per_page={limit}"
        headers = self._headers(token)

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    raw_prs = res.json()
                    prs = []
                    for item in raw_prs:
                        head = item.get("head") or {}
                        base = item.get("base") or {}
                        prs.append({
                            "id": str(item.get("id")),
                            "number": item.get("number"),
                            "title": item.get("title", "Untitled PR"),
                            "body": item.get("body") or "",
                            "state": item.get("state", "open").upper(),
                            "author": (item.get("user") or {}).get("login", "unknown"),
                            "branch": head.get("ref", "unknown"),
                            "base_branch": base.get("ref", "main"),
                            "created_at": item.get("created_at", ""),
                            "draft": item.get("draft", False),
                            "html_url": item.get("html_url", ""),
                        })
                    return {"ok": True, "pull_requests": prs, "count": len(prs)}
                return {"ok": False, "error": f"GitHub API error {res.status_code}", "pull_requests": []}
        except Exception as e:
            return {"ok": False, "error": str(e), "pull_requests": []}

    def get_workflow_runs(self, repo_slug: str, token: Optional[str] = None, limit: int = 15) -> Dict[str, Any]:
        """Fetches GitHub Actions workflow runs and deployment logs."""
        slug = self.normalize_slug(repo_slug)
        url = f"{GITHUB_API_BASE}/repos/{slug}/actions/runs?per_page={limit}"
        headers = self._headers(token)

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    runs = []
                    for item in res.json().get("workflow_runs", []):
                        head_commit = item.get("head_commit") or {}
                        runs.append({
                            "id": str(item.get("id")),
                            "name": item.get("name", "CI/CD Deployment"),
                            "status": item.get("status", "unknown").upper(),
                            "conclusion": (item.get("conclusion") or "running").upper(),
                            "branch": item.get("head_branch", "main"),
                            "commit_id": (item.get("head_sha") or "")[:8],
                            "commit_message": head_commit.get("message", ""),
                            "event": item.get("event", "push"),
                            "created_at": item.get("created_at", ""),
                            "html_url": item.get("html_url", ""),
                        })
                    return {"ok": True, "runs": runs, "count": len(runs)}
                return {"ok": False, "error": f"GitHub API error {res.status_code}", "runs": []}
        except Exception as e:
            return {"ok": False, "error": str(e), "runs": []}

    @staticmethod
    def inspect_local_commits(local_path: str, limit: int = 25) -> List[Dict[str, Any]]:
        """Reads real git history from the cloned local directory."""
        p = Path(local_path).resolve()
        if not p.exists() or not (p / ".git").exists():
            return []

        try:
            res = subprocess.run(
                ["git", "log", f"-n{limit}", "--pretty=format:%h||%an||%ar||%s"],
                cwd=str(p),
                capture_output=True,
                text=True,
                timeout=5,
            )
            if res.returncode != 0:
                return []

            commits = []
            for line in res.stdout.strip().splitlines():
                parts = line.split("||", 3)
                if len(parts) == 4:
                    commits.append({
                        "hash": parts[0],
                        "author": parts[1],
                        "time": parts[2],
                        "message": parts[3],
                    })
            return commits
        except Exception as e:
            logger.warning(f"Error reading local commits from {local_path}: {e}")
            return []

    def create_pull_request(
        self,
        repo_slug: str,
        title: str,
        body: str,
        head_branch: str,
        base_branch: str = "main",
        draft: bool = False,
        token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Creates a Pull Request on GitHub."""
        slug = self.normalize_slug(repo_slug)
        url = f"{GITHUB_API_BASE}/repos/{slug}/pulls"
        headers = self._headers(token)
        payload = {
            "title": title,
            "head": head_branch,
            "base": base_branch,
            "body": body,
            "draft": draft,
        }

        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload, headers=headers)
                if res.status_code in (200, 201):
                    data = res.json()
                    return {
                        "ok": True,
                        "pr_number": data.get("number"),
                        "pr_url": data.get("html_url"),
                        "raw": data,
                    }
                return {
                    "ok": False,
                    "error": f"GitHub API error {res.status_code}: {res.text[:200]}",
                    "status_code": res.status_code,
                }
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def merge_pull_request(
        self,
        repo_slug: str,
        pr_number: int,
        commit_title: Optional[str] = None,
        commit_message: Optional[str] = None,
        merge_method: str = "merge",
        token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Merges a Pull Request on GitHub."""
        slug = self.normalize_slug(repo_slug)
        url = f"{GITHUB_API_BASE}/repos/{slug}/pulls/{pr_number}/merge"
        headers = self._headers(token)
        payload: Dict[str, Any] = {"merge_method": merge_method}
        if commit_title:
            payload["commit_title"] = commit_title
        if commit_message:
            payload["commit_message"] = commit_message

        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.put(url, json=payload, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    return {
                        "ok": True,
                        "sha": data.get("sha"),
                        "merged": data.get("merged", True),
                        "message": data.get("message", "PR merged successfully"),
                    }
                return {
                    "ok": False,
                    "error": f"GitHub API merge error {res.status_code}: {res.text[:200]}",
                    "status_code": res.status_code,
                }
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def create_issue(
        self,
        repo_slug: str,
        title: str,
        body: str,
        labels: Optional[List[str]] = None,
        token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Creates a new issue on GitHub."""
        slug = self.normalize_slug(repo_slug)
        url = f"{GITHUB_API_BASE}/repos/{slug}/issues"
        headers = self._headers(token)
        payload: Dict[str, Any] = {
            "title": title,
            "body": body,
        }
        if labels:
            payload["labels"] = labels

        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload, headers=headers)
                if res.status_code in (200, 201):
                    data = res.json()
                    return {
                        "ok": True,
                        "issue_number": data.get("number"),
                        "issue_url": data.get("html_url"),
                        "raw": data,
                    }
                return {
                    "ok": False,
                    "error": f"GitHub API error {res.status_code}: {res.text[:200]}",
                    "status_code": res.status_code,
                }
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def add_issue_comment(
        self,
        repo_slug: str,
        issue_number: int,
        comment_body: str,
        token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Adds a comment to an issue on GitHub."""
        slug = self.normalize_slug(repo_slug)
        url = f"{GITHUB_API_BASE}/repos/{slug}/issues/{issue_number}/comments"
        headers = self._headers(token)
        payload = {"body": comment_body}

        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload, headers=headers)
                if res.status_code in (200, 201):
                    data = res.json()
                    return {
                        "ok": True,
                        "comment_id": data.get("id"),
                        "comment_url": data.get("html_url"),
                    }
                return {
                    "ok": False,
                    "error": f"GitHub API error {res.status_code}: {res.text[:200]}",
                    "status_code": res.status_code,
                }
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def close_issue(
        self,
        repo_slug: str,
        issue_number: int,
        comment: Optional[str] = None,
        state_reason: str = "completed",
        token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Closes an issue on GitHub with optional closing comment."""
        if comment:
            self.add_issue_comment(repo_slug, issue_number, comment, token=token)

        slug = self.normalize_slug(repo_slug)
        url = f"{GITHUB_API_BASE}/repos/{slug}/issues/{issue_number}"
        headers = self._headers(token)
        payload = {"state": "closed", "state_reason": state_reason}

        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.patch(url, json=payload, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    return {
                        "ok": True,
                        "issue_number": data.get("number"),
                        "state": data.get("state"),
                        "message": f"Issue #{issue_number} closed successfully",
                    }
                return {
                    "ok": False,
                    "error": f"GitHub API close error {res.status_code}: {res.text[:200]}",
                    "status_code": res.status_code,
                }
        except Exception as e:
            return {"ok": False, "error": str(e)}

