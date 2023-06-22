from typing import Generator

import pytest
from fastapi.testclient import TestClient
from pytest_mock_resources import create_postgres_fixture

from peated.core.config import settings
from peated.db.base import Base
from peated.db.session import SessionLocal
from peated.main import app


def pytest_configure(config):
    settings.GOOGLE_CLIENT_ID = "google-client-id"
    settings.GOOGLE_CLIENT_SECRET = "google-client-secret"


pg = create_postgres_fixture(Base, session=True)


@pytest.fixture(scope="session")
def db() -> Generator:
    yield SessionLocal()


@pytest.fixture(scope="module")
def client() -> Generator:
    with TestClient(app) as c:
        yield c


# @pytest.fixture(scope="module")
# def superuser_token_headers(client: TestClient) -> Dict[str, str]:
#     return get_superuser_token_headers(client)


# @pytest.fixture(scope="module")
# def normal_user_token_headers(client: TestClient, db: Session) -> Dict[str, str]:
#     return authentication_token_from_email(client=client, email=settings.EMAIL_TEST_USER, db=db)


# @pytest.fixture
# def alembic_engine():
#     """Override this fixture to provide pytest-alembic powered tests with a database handle."""
#     return sqlalchemy.create_engine("postgres")


# @event.listens_for(Session, "after_transaction_end")
# def restart_savepoint(session, transaction):
#     if transaction.nested and not transaction._parent.nested:
#         session.begin_nested()


# @pytest.fixture(scope="function", autouse=True)
# def db_session(request, db):
#     with db.begin_nested():
#         yield
