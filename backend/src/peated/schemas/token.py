from typing import Optional

from pydantic import BaseModel

__all__ = ["Token", "TokenPayload"]


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenPayload(BaseModel):
    sub: Optional[int] = None
