from sqlalchemy import BigInteger, Column, DateTime, ForeignKeyConstraint, Index, PrimaryKeyConstraint, text
from sqlalchemy.orm import relationship

from peated.db.base_class import Base


class CollectionBottle(Base):
    __tablename__ = "collection_bottle"
    __table_args__ = (
        ForeignKeyConstraint(
            ["bottle_id"],
            ["bottle.id"],
            name="collection_bottle_bottle_id_bottle_id_fk",
        ),
        ForeignKeyConstraint(
            ["collection_id"],
            ["collection.id"],
            name="collection_bottle_collection_id_collection_id_fk",
        ),
        PrimaryKeyConstraint("id", name="collection_bottle_pkey"),
        Index("collection_bottle_unq", "collection_id", "bottle_id", unique=True),
    )

    collection_id = Column(BigInteger, nullable=False)
    bottle_id = Column(BigInteger, nullable=False)
    id = Column(BigInteger)
    created_at = Column(DateTime, nullable=False, server_default=text("now()"))

    bottle = relationship("Bottle")
    collection = relationship("Collection")
