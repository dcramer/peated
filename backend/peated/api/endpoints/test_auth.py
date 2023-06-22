from fastapi.testclient import TestClient

from peated.main import app

client = TestClient(app)


def test_auth_basic():
    response = client.post("/auth/basic")
    assert response.status_code == 400
