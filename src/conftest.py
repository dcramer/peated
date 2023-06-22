from typing import Generator

import psycopg2
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text

from peated.core.config import settings
from peated.core.security import get_password_hash
from peated.db.base import Base
from peated.db.session import Session
from peated.factories.user import UserFactory
from peated.main import app


def pytest_configure(config):
    settings.DATABASE_URL = settings.DATABASE_URL.rsplit("/", 1)[0] + "/" + settings.TEST_DB_NAME
    settings.GOOGLE_CLIENT_ID = "google-client-id"
    settings.GOOGLE_CLIENT_SECRET = "google-client-secret"


@pytest.fixture(scope="session")
def setup_db(request):
    try:
        engine = create_engine(
            settings.DATABASE_URL.rsplit("/", 1)[0], execution_options={"isolation_level": "AUTOCOMMIT"}
        )
        with engine.connect() as connection:
            connection.execute(text(f"CREATE DATABASE {settings.TEST_DB_NAME}"))
    except psycopg2.errors.DuplicateDatabase:
        pass
    except Exception:
        pass

    yield

    engine = create_engine(settings.DATABASE_URL.rsplit("/", 1)[0], execution_options={"isolation_level": "AUTOCOMMIT"})
    with engine.connect() as connection:
        connection.execute(text(f"DROP DATABASE {settings.TEST_DB_NAME}"))
    connection.close()


@pytest.fixture(scope="session")
def connection(request):
    # Create a new engine/connection that will actually connect
    # to the test database we just created. This will be the
    # connection used by the test suite run.
    engine = create_engine(settings.DATABASE_URL)
    connection = engine.connect()
    yield connection
    connection.close()


@pytest.fixture(scope="session")
def migrate_db(connection, request):
    """Setup test database.

    Creates all database tables as declared in SQLAlchemy models,
    then proceeds to drop all the created tables after all tests
    have finished running.
    """

    Base.metadata.bind = connection
    Base.metadata.create_all(connection)

    yield

    Base.metadata.drop_all(connection)


@pytest.fixture(autouse=True)
def session(connection, request):
    transaction = connection.begin()
    session = Session(bind=connection)
    session.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def restart_savepoint(db_session, transaction):
        if transaction.nested and not transaction._parent.nested:
            session.expire_all()
            session.begin_nested()

    def teardown():
        Session.remove()
        transaction.rollback()

    request.addfinalizer(teardown)
    return session


@pytest.fixture(scope="session")
def db(session) -> Generator:
    yield session


@pytest.fixture(scope="module")
def client() -> Generator:
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="function")
def default_admin():
    return UserFactory(email="admin@example.com", admin=True, password_hash=get_password_hash("admin"))


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
