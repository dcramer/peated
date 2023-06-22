from sqlalchemy import BigInteger, Boolean, Column, DateTime, Index, PrimaryKeyConstraint, String, Text, text

from peated.db.base import Base


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
