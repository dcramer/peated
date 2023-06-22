from fastapi.testclient import TestClient

from peated.main import app

client = TestClient(app)


def test_auth_basic_valid_creds(default_admin):
    response = client.post("/auth/basic", json={"email": "admin@example.com", "password": "admin"})
    assert response.status_code == 200, response.json()


def test_auth_basic_invalid_creds(default_admin):
    response = client.post("/auth/basic", json={"email": "admin@example.com", "password": "not-admin"})
    assert response.status_code == 400, response.json()
