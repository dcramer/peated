from peated.core.celery_app import celery_app
from peated.core.config import settings

from sentry_sdk.integrations.celery import CeleryIntegration

import sentry_sdk

sentry_sdk.init(
    dsn=settings.SENTRY_DSNm,
    traces_sample_rate=1.0,
    profiles_sample_rate=1.0,
    integrations=[
        CeleryIntegration(
            monitor_beat_tasks=True,
        )
    ],
)


@celery_app.task(acks_late=True)
def test_celery(word: str) -> str:
    return f"test task return {word}"
