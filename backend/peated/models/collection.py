from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    ForeignKeyConstraint,
    Index,
    PrimaryKeyConstraint,
    String,
    text,
)
from sqlalchemy.orm import relationship

from peated.db.base_class import Base


class Collection(Base):
    __tablename__ = "collection"
    __table_args__ = (
        ForeignKeyConstraint(["created_by_id"], ["user.id"], name="collection_created_by_id_user_id_fk"),
        PrimaryKeyConstraint("id", name="collection_pkey"),
        Index("collection_name_unq", "name", "created_by_id", unique=True),
    )

    id = Column(BigInteger)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=text("now()"))
    created_by_id = Column(BigInteger, nullable=False)
    total_bottles = Column(BigInteger, nullable=False, server_default=text("0"))

    created_by = relationship("User", back_populates="collection")
    collection_bottle = relationship("CollectionBottle", back_populates="collection")
