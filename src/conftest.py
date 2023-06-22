from peated.core.config import settings

pytest_plugins = ["peated.testutils.pytest"]


def pytest_configure(config):
    settings.DATABASE_URL = settings.DATABASE_URL.rsplit("/", 1)[0] + "/" + settings.TEST_DB_NAME
    settings.GOOGLE_CLIENT_ID = "google-client-id"
    settings.GOOGLE_CLIENT_SECRET = "google-client-secret"
