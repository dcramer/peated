from sqlalchemy import BigInteger, Column, DateTime, Enum, ForeignKeyConstraint, Index, PrimaryKeyConstraint, text

from peated.db.base import Base


class Follow(Base):
    __tablename__ = "follow"
    __table_args__ = (
        ForeignKeyConstraint(["from_user_id"], ["user.id"], name="follow_from_user_id_user_id_fk"),
        ForeignKeyConstraint(["to_user_id"], ["user.id"], name="follow_to_user_id_user_id_fk"),
        PrimaryKeyConstraint("id", name="follow_pkey"),
        Index("follow_unq", "from_user_id", "to_user_id", unique=True),
    )

    from_user_id = Column(BigInteger, nullable=False)
    to_user_id = Column(BigInteger, nullable=False)
    status = Column(
        Enum("none", "pending", "following", name="follow_status"),
        nullable=False,
        server_default=text("'pending'::follow_status"),
    )
    created_at = Column(DateTime, nullable=False, server_default=text("now()"))
    id = Column(BigInteger)
