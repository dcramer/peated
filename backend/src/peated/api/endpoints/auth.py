from datetime import timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Form, HTTPException
from google.auth.transport import requests
from google.oauth2 import id_token
from sqlalchemy.orm import Session

from peated import crud, models, schemas
from peated.api import deps
from peated.core import security
from peated.core.config import settings

router = APIRouter()


@router.get("/", response_model=schemas.Token)
def auth_details(
    current_user: models.User = Depends(deps.get_current_active_user),
):
    return {"user": current_user}


@router.post("/basic", response_model=schemas.Token)
def auth_basic(
    email: Annotated[str, Form()],
    password: Annotated[str, Form()],
    db: Session = Depends(deps.get_db),
) -> Any:
    user = crud.user.authenticate(db, email=email, password=password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not crud.user.is_active(user):
        raise HTTPException(status_code=400, detail="Inactive user")
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }


@router.post("/google", response_model=schemas.Token)
def auth_google(
    code: Annotated[str, Form()], db: Session = Depends(deps.get_db)
) -> Any:
    resp = requests.post(
        "https://www.googleapis.com/oauth2/v4/token",
        json={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": "postmessage",
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
        },
    )
    data = resp.json()
    if resp.status_code != 200:
        if "error_description" in data:
            raise HTTPException(status_code=500, detail=data["error_description"])
        elif "error" in data:
            raise HTTPException(
                status_code=500,
                detail="Error exchanging token: {}".format(data["error"]),
            )
        else:
            resp.raise_for_status()

    payload = id_token.verify_oauth2_token(
        data["id_token"], requests.Request(), settings.GOOGLE_CLIENT_ID
    )

    user = crud.user.get_by_identity("google", payload["sub"])
    with db.begin_nested():
        # try to associate w/ existing user
        if not user:
            user = crud.user.get_by_email(db, payload["email"])
        # create new account
        else:
            user = crud.user.create(
                db,
                {
                    "full_name": payload["given_name"],
                    "username": payload.email.split("@", 1)[0],
                    "email": payload["email"],
                },
            )
        db.session.add(
            models.Identity(
                user_id=user.id,
                provider="google",
                external_id=payload["sub"],
            )
        )

    if not user.active:
        raise HTTPException(status_code=401, detail="Inactive account")

    return {
        "access_token": security.create_access_token(
            user.id,
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        ),
        "user": user,
    }
