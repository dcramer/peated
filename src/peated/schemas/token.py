from typing import Optional

from pydantic import BaseModel

from .user import User

__all__ = ["Token", "TokenPayload"]


class Token(BaseModel):
    access_token: str
    user: User


class TokenPayload(BaseModel):
    sub: Optional[int] = None
