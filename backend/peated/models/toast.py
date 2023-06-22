from sqlalchemy import BigInteger, Column, DateTime, Index, PrimaryKeyConstraint, text
from sqlalchemy.orm import relationship

from peated.db.base_class import Base


class Toast(Base):
    __tablename__ = "toasts"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="toast_pkey"),
        Index("toast_unq", "tasting_id", "created_by_id", unique=True),
    )

    id = Column(BigInteger)
    created_at = Column(DateTime, nullable=False, server_default=text("now()"))
    created_by_id = Column(BigInteger, nullable=False)
    tasting_id = Column(BigInteger, nullable=False)

    created_by = relationship("User", back_populates="toast")
    tasting = relationship("Tasting", back_populates="toast")
