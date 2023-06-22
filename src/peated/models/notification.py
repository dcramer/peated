from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKeyConstraint,
    Index,
    PrimaryKeyConstraint,
    text,
)

from peated.db.base import Base


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        ForeignKeyConstraint(["from_user_id"], ["user.id"], name="notifications_from_user_id_user_id_fk"),
        ForeignKeyConstraint(["user_id"], ["user.id"], name="notifications_user_id_user_id_fk"),
        PrimaryKeyConstraint("id", name="notifications_pkey"),
        Index(
            "notifications_unq",
            "user_id",
            "object_id",
            "object_type",
            "created_at",
            unique=True,
        ),
    )

    id = Column(BigInteger)
    user_id = Column(BigInteger, nullable=False)
    object_id = Column(BigInteger, nullable=False)
    object_type = Column(
        Enum(
            "bottle",
            "edition",
            "entity",
            "tasting",
            "toast",
            "follow",
            "comment",
            name="object_type",
        ),
        nullable=False,
    )
    created_at = Column(DateTime, nullable=False)
    read = Column(Boolean, nullable=False, server_default=text("false"))
    from_user_id = Column(BigInteger)
