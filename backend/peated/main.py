from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from peated.api.router import api_router
from peated.core.config import settings

app = FastAPI(title="api.peated.app", openapi_url="/openapi.json")

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router)
