from typing import Optional

from pydantic import BaseModel, EmailStr

__all__ = ["UserCreate", "UserUpdate", "UserInDB", "User"]


# Shared properties
class UserBase(BaseModel):
    username: Optional[str]
    email: Optional[EmailStr] = None
    display_name: Optional[str] = None

    private: bool = False
    active: Optional[bool] = True

    admin: bool = False
    mod: bool = False


# Properties to receive via API on creation
class UserCreate(UserBase):
    username: str
    display_name: str
    email: EmailStr
    password: Optional[str] = None


# Properties to receive via API on update
class UserUpdate(UserBase):
    password: Optional[str] = None


class UserInDBBase(UserBase):
    id: Optional[int] = None

    class Config:
        orm_mode = True


# Additional properties to return via API
class User(UserInDBBase):
    pass


# Additional properties stored in DB
class UserInDB(UserInDBBase):
    password: str
