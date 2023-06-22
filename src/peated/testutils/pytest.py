import os
from typing import Generator

import alembic
import psycopg2
import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text

from peated.core.config import settings
from peated.core.security import get_password_hash
from peated.db.session import Session
from peated.factories.user import UserFactory
from peated.main import app


@pytest.fixture(scope="session", autouse=True)
def connection(request):
    # Create DB if not exists
    engine = create_engine(settings.DATABASE_URL.rsplit("/", 1)[0], execution_options={"isolation_level": "AUTOCOMMIT"})
    try:
        with engine.connect() as connection:
            connection.execute(text(f"CREATE DATABASE {settings.TEST_DB_NAME}"))
    except psycopg2.errors.DuplicateDatabase:
        pass
    except Exception:
        pass

    # Run migrations
    engine = create_engine(settings.DATABASE_URL)
    base_path = os.path.join(os.path.dirname(__file__), os.pardir)
    alembic_cfg = Config(os.path.join(base_path, "alembic.ini"))
    alembic_cfg.attributes["connectable"] = engine
    alembic_cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    alembic_cfg.set_section_option(
        "alembic",
        "script_location",
        os.path.join(base_path, "alembic"),
    )

    alembic.command.upgrade(alembic_cfg, "head")

    # Hand control over
    with engine.connect() as connection:
        yield connection

    # Clean up after ourselves
    engine = create_engine(settings.DATABASE_URL.rsplit("/", 1)[0], execution_options={"isolation_level": "AUTOCOMMIT"})
    with engine.connect() as connection:
        connection.execute(text(f"DROP DATABASE {settings.TEST_DB_NAME}"))


@event.listens_for(Session, "after_transaction_end")
def restart_savepoint(session, transaction):
    if transaction.nested and not transaction._parent.nested:
        session.expire_all()
        session.begin_nested()


@pytest.fixture(scope="function", autouse=True)
def db(request, connection):
    transaction = connection.begin()

    Session.configure(bind=connection)

    session = Session()
    session.begin_nested()

    yield session

    Session.remove()
    transaction.rollback()


@pytest.fixture(scope="module")
def client() -> Generator:
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="function")
def default_admin():
    return UserFactory(email="admin@example.com", admin=True, password_hash=get_password_hash("admin"))
