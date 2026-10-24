"""Security boundaries for authenticated operator access."""

import os
import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.prodpilot.api.server import app


client = TestClient(app)


def test_signed_operator_session_is_required_in_strict_mode():
    username = f"security-{uuid.uuid4().hex[:12]}"
    with patch.dict(
        os.environ,
        {"PRODPILOT_SESSION_SECRET": "test-session-secret", "PRODPILOT_REQUIRE_AUTH": "true"},
    ):
        signup = client.post(
            "/auth/signup",
            json={"username": username, "password": "sufficiently-long-test-password"},
        )
        assert signup.status_code == 200
        token = signup.json()["token"]

        # Health stays available for local process supervision; API data does not.
        assert client.get("/health").status_code == 200
        assert client.get("/incidents").status_code == 401

        authenticated = client.get("/incidents", headers={"Authorization": f"Bearer {token}"})
        assert authenticated.status_code == 200

        # A one-character token change must invalidate the HMAC signature.
        forged = f"{token[:-1]}{'0' if token[-1] != '0' else '1'}"
        assert client.get("/incidents", headers={"Authorization": f"Bearer {forged}"}).status_code == 401
