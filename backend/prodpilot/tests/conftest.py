import os
import sys
import tempfile
from pathlib import Path

# Create session-scoped isolated test db immediately at import time
_TEMP_TEST_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
TEST_DB_PATH = _TEMP_TEST_DB.name
_TEMP_TEST_DB.close()
os.environ["PRODPILOT_DB_PATH"] = TEST_DB_PATH

REPO_ROOT = str(Path(__file__).resolve().parent.parent.parent.parent)
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from backend.prodpilot.db import init_db
init_db(TEST_DB_PATH)

import pytest

@pytest.fixture(autouse=True, scope="session")
def isolate_test_database():
    """Ensures test runs NEVER touch or pollute the production prodpilot.db database."""
    yield TEST_DB_PATH
    try:
        Path(TEST_DB_PATH).unlink(missing_ok=True)
    except Exception:
        pass
