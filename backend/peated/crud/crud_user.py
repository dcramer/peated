from typing import Any, Dict, Optional, Union

from sqlalchemy.orm import Session

from peated.core.security import get_password_hash, verify_password
from peated.models import Identity, User
from peated.schemas.user import UserCreate, UserUpdate

from .base import CRUDBase


class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    def get_by_email(self, db: Session, *, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email).first()

    def get_by_identity(self, db: Session, *, provider: str, external_id: str) -> Optional[User]:
        return (
            db.query(User)
            .join(Identity, Identity.user_id == User.id)
            .filter(Identity.provider == provider, Identity.external_id == external_id)
            .first()
        )

    def create(self, db: Session, *, obj_in: UserCreate) -> User:
        db_obj = User(
            email=obj_in.email,
            password=get_password_hash(obj_in.password) if obj_in.password else None,
            full_name=obj_in.full_name,
            admin=obj_in.admin,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, *, db_obj: User, obj_in: Union[UserUpdate, Dict[str, Any]]) -> User:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)
        if update_data["password"]:
            hashed_password = get_password_hash(update_data["password"])
            del update_data["password"]
            update_data["hashed_password"] = hashed_password
        return super().update(db, db_obj=db_obj, obj_in=update_data)

    def authenticate(self, db: Session, *, email: str, password: str) -> Optional[User]:
        user = self.get_by_email(db, email=email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    def is_active(self, user: User) -> bool:
        return user.active

    def is_admin(self, user: User) -> bool:
        return user.admin

    def is_mod(self, user: User) -> bool:
        return user.mod


user = CRUDUser(User)
