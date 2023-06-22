from sqlalchemy import BigInteger, Column, DateTime, ForeignKeyConstraint, Index, PrimaryKeyConstraint, text

from peated.db.base import Base


class Toast(Base):
    __tablename__ = "toasts"
    __table_args__ = (
        ForeignKeyConstraint(["tasting_id"], ["tasting.id"], name="toast_tasting_id_tasting_id_fk"),
        ForeignKeyConstraint(["created_by_id"], ["user.id"], name="toast_created_by_id_user_id_fk"),
        PrimaryKeyConstraint("id", name="toast_pkey"),
        Index("toast_unq", "tasting_id", "created_by_id", unique=True),
    )

    id = Column(BigInteger)
    created_at = Column(DateTime, nullable=False, server_default=text("now()"))
    created_by_id = Column(BigInteger, nullable=False)
    tasting_id = Column(BigInteger, nullable=False)
