from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Index,
    PrimaryKeyConstraint,
    String,
    Text,
    text,
)
from sqlalchemy.orm import relationship

from peated.db.base_class import Base


class User(Base):
    __tablename__ = "user"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="user_pkey"),
        Index("user_email_unq", "email", unique=True),
        Index("user_username_unq", "username", unique=True),
    )

    id = Column(BigInteger)
    email = Column(Text, nullable=False)
    active = Column(Boolean, nullable=False, server_default=text("true"))
    admin = Column(Boolean, nullable=False, server_default=text("false"))
    created_at = Column(DateTime, nullable=False, server_default=text("now()"))
    mod = Column(Boolean, nullable=False, server_default=text("false"))
    username = Column(Text, nullable=False)
    private = Column(Boolean, nullable=False, server_default=text("false"))
    password_hash = Column(String(256))
    display_name = Column(Text)
    picture_url = Column(Text)

    change = relationship("Change", back_populates="created_by")
    collection = relationship("Collection", back_populates="created_by")
    entity = relationship("Entity", back_populates="created_by")
    follow = relationship("Follow", foreign_keys="[Follow.from_user_id]", back_populates="from_user")
    follow_ = relationship("Follow", foreign_keys="[Follow.to_user_id]", back_populates="to_user")
    identity = relationship("Identity", back_populates="user")
    notifications = relationship(
        "Notifications",
        foreign_keys="[Notifications.from_user_id]",
        back_populates="from_user",
    )
    notifications_ = relationship("Notifications", foreign_keys="[Notifications.user_id]", back_populates="user")
    bottle = relationship("Bottle", back_populates="created_by")
    tasting = relationship("Tasting", back_populates="created_by")
    comments = relationship("Comments", back_populates="created_by")
