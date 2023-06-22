from fastapi.testclient import TestClient

from peated.main import app

client = TestClient(app)


def test_auth_basic():
    response = client.post("/auth/basic", json={"email": "foo@example.com", "password": "foobar"})
    assert response.status_code == 400
