"""Pytest configuration and session fixtures for unified test execution."""

import os
import subprocess
import sys
import tempfile
from pathlib import Path

# Create session-scoped isolated test db immediately at import time
_TEMP_TEST_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
TEST_DB_PATH = _TEMP_TEST_DB.name
_TEMP_TEST_DB.close()
os.environ["PRODPILOT_DB_PATH"] = TEST_DB_PATH

# Default to fast, deterministic execution unless overridden
os.environ.setdefault("PRODPILOT_AGENT_ADAPTER", "mock")
os.environ.setdefault("PRODPILOT_DEPLOY_TARGET", "disabled")
os.environ.setdefault("PRODPILOT_WATCHDOG_DURATION", "1")
os.environ.setdefault("PRODPILOT_WATCHDOG_INTERVAL", "0.05")
os.environ.setdefault("CLOUDFLARE_TUNNEL_URL", "http://localhost:8765")

REPO_ROOT = str(Path(__file__).resolve().parent.parent.parent.parent)
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from backend.prodpilot.db import init_db
init_db(TEST_DB_PATH)

import pytest


def pytest_addoption(parser):
    """Add CLI flags for test execution modes."""
    parser.addoption(
        "--live-agent",
        action="store_true",
        default=False,
        help="Run tests against live Antigravity / Gemini agent adapter instead of mock",
    )


def pytest_configure(config):
    """Configure pytest markers and environment options."""
    if config.getoption("--live-agent", default=False):
        os.environ["PRODPILOT_AGENT_ADAPTER"] = "auto"
    else:
        os.environ["PRODPILOT_AGENT_ADAPTER"] = "mock"


@pytest.fixture(autouse=True, scope="session")
def isolate_test_database():
    """Ensures test runs NEVER touch or pollute the production prodpilot.db database."""
    yield TEST_DB_PATH
    try:
        Path(TEST_DB_PATH).unlink(missing_ok=True)
    except Exception:
        pass


@pytest.fixture
def mock_microservice_repo(tmp_path):
    """Fixture providing a mock microservice git repository with the suspect commit."""
    repo = tmp_path / "mock-service"
    repo.mkdir(parents=True, exist_ok=True)

    def git(*args):
        res = subprocess.run(["git", *args], cwd=str(repo), capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"Git failed: {' '.join(args)} -> {res.stderr}")
        return res.stdout.strip()

    git("init", "-b", "main")
    git("config", "user.name", "Vishnu Nandan")
    git("config", "user.email", "vishnu@prodpilot.io")

    app_code = '''from fastapi import FastAPI, HTTPException
app = FastAPI()

def calculate_order(order: dict) -> float:
    items = order.get("items", [])
    total = sum(i.get("price", 0) * i.get("qty", 1) for i in items)
    discount = order["discount"]
    return total - discount

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/orders")
def create_order(order: dict):
    try:
        total = calculate_order(order)
        return {"total": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
'''
    (repo / "app.py").write_text(app_code, encoding="utf-8")

    tests_dir = repo / "tests"
    tests_dir.mkdir(exist_ok=True)
    test_code = '''import pytest
from app import calculate_order

def test_order_with_discount():
    order = {"items": [{"price": 10.0, "qty": 2}], "discount": 5.0}
    assert calculate_order(order) == 15.0
'''
    (tests_dir / "test_orders.py").write_text(test_code, encoding="utf-8")

    git("add", "-A")
    suspect_hash = git("commit", "-m", "feat: add discount support to order checkout")

    return str(repo), suspect_hash
