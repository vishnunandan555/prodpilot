import os
import sys
import tempfile
from pathlib import Path
import pytest

REPO_ROOT = str(Path(__file__).resolve().parent.parent.parent.parent)
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from backend.prodpilot.db import init_db

@pytest.fixture(autouse=True, scope="session")
def isolate_test_database():
    """Ensures test runs NEVER touch or pollute the production prodpilot.db database."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp_db:
        test_db_path = tmp_db.name

    old_env = os.environ.get("PRODPILOT_DB_PATH")
    os.environ["PRODPILOT_DB_PATH"] = test_db_path
    init_db(test_db_path)

    yield test_db_path

    if old_env is not None:
        os.environ["PRODPILOT_DB_PATH"] = old_env
    else:
        os.environ.pop("PRODPILOT_DB_PATH", None)

    try:
        Path(test_db_path).unlink(missing_ok=True)
    except Exception:
        pass
