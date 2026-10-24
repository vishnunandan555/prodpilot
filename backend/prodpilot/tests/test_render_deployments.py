import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from backend.prodpilot.api.server import app
from backend.prodpilot.db import create_server, init_db, get_server

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db(tmp_path):
    test_db = str(tmp_path / "test_deploy.db")
    init_db(test_db)
    with patch("backend.prodpilot.db.DEFAULT_DB_PATH", test_db), \
         patch("backend.prodpilot.api.connect_router.get_server") as mock_get_srv, \
         patch("backend.prodpilot.api.connect_router.get_effective_render_key", return_value="rnd_testkey123"):
        mock_get_srv.return_value = {
            "id": "srv-local-1",
            "name": "test-api",
            "health_url": "http://127.0.0.1:8000/health",
            "render_service_id": "srv-test1234",
            "render_api_key": "rnd_testkey123",
        }
        yield test_db


def test_trigger_server_deploy(setup_db):
    server = create_server(
        name="test-api",
        health_url="http://127.0.0.1:8000/health",
        render_service_id="srv-test1234",
        db_path=setup_db,
    )

    with patch("backend.prodpilot.integrations.render_client.RenderClient.trigger_deploy") as mock_deploy:
        mock_deploy.return_value = {
            "ok": True,
            "deploy_id": "dep-new123",
            "status": "CREATED",
            "commit_id": "a1b2c3d4",
        }

        # 1. Trigger latest deploy
        res = client.post(f"/servers/{server['id']}/deploy", json={"clear_cache": False})
        assert res.status_code == 200
        data = res.json()
        assert data["ok"] is True
        assert data["deploy_id"] == "dep-new123"
        mock_deploy.assert_called_with(
            service_id="srv-test1234",
            api_key="rnd_testkey123",
            clear_cache=False,
            commit_id=None,
        )

        # 2. Trigger with specific commit and clear_cache
        res2 = client.post(
            f"/servers/{server['id']}/deploy",
            json={"clear_cache": True, "commit_id": "9876543210abcdef"},
        )
        assert res2.status_code == 200
        mock_deploy.assert_called_with(
            service_id="srv-test1234",
            api_key="rnd_testkey123",
            clear_cache=True,
            commit_id="9876543210abcdef",
        )


def test_rollback_server_deploy(setup_db):
    server = create_server(
        name="test-api",
        health_url="http://127.0.0.1:8000/health",
        render_service_id="srv-test1234",
        db_path=setup_db,
    )

    with patch("backend.prodpilot.integrations.render_client.RenderClient.get_deploy") as mock_get_deploy, \
         patch("backend.prodpilot.integrations.render_client.RenderClient.trigger_deploy") as mock_trigger:
        
        mock_get_deploy.return_value = {
            "ok": True,
            "deploy": {
                "id": "dep-old999",
                "commit_hash": "abcdef1234567890",
                "status": "LIVE",
            },
        }
        mock_trigger.return_value = {
            "ok": True,
            "deploy_id": "dep-rollback001",
            "status": "CREATED",
        }

        res = client.post(f"/servers/{server['id']}/deploys/dep-old999/rollback")
        assert res.status_code == 200
        data = res.json()
        assert data["ok"] is True
        assert data["deploy_id"] == "dep-rollback001"
        assert data["rollback_target_commit"] == "abcdef1234567890"

        mock_trigger.assert_called_with(
            service_id="srv-test1234",
            api_key="rnd_testkey123",
            clear_cache=False,
            commit_id="abcdef1234567890",
        )


def test_cancel_server_deploy(setup_db):
    server = create_server(
        name="test-api",
        health_url="http://127.0.0.1:8000/health",
        render_service_id="srv-test1234",
        db_path=setup_db,
    )

    with patch("backend.prodpilot.integrations.render_client.RenderClient.cancel_deploy") as mock_cancel:
        mock_cancel.return_value = {"ok": True, "message": "Deployment canceled."}

        res = client.post(f"/servers/{server['id']}/deploys/dep-building/cancel")
        assert res.status_code == 200
        assert res.json()["ok"] is True
        mock_cancel.assert_called_with("srv-test1234", "dep-building", api_key="rnd_testkey123")
