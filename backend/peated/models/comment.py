from sqlalchemy import BigInteger, Column, DateTime, ForeignKeyConstraint, Index, PrimaryKeyConstraint, Text, text
from sqlalchemy.orm import relationship

from peated.db.base_class import Base


class Comment(Base):
    __tablename__ = "comments"
    __table_args__ = (
        ForeignKeyConstraint(["created_by_id"], ["user.id"], name="comments_created_by_id_user_id_fk"),
        ForeignKeyConstraint(["tasting_id"], ["tasting.id"], name="comments_tasting_id_tasting_id_fk"),
        PrimaryKeyConstraint("id", name="comments_pkey"),
        Index("comment_unq", "tasting_id", "created_by_id", "created_at", unique=True),
    )

    id = Column(BigInteger)
    tasting_id = Column(BigInteger, nullable=False)
    comment = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=text("now()"))
    created_by_id = Column(BigInteger, nullable=False)

    created_by = relationship("User")
    tasting = relationship("Tasting")
