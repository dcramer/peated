from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    ForeignKeyConstraint,
    Index,
    Integer,
    PrimaryKeyConstraint,
    Text,
    text,
)
from sqlalchemy.orm import relationship

from peated.db.base_class import Base


class StorePrice(Base):
    __tablename__ = "store_price"
    __table_args__ = (
        ForeignKeyConstraint(
            ["bottle_id"], ["bottle.id"], name="store_price_bottle_id_bottle_id_fk"
        ),
        ForeignKeyConstraint(
            ["store_id"], ["store.id"], name="store_price_store_id_store_id_fk"
        ),
        PrimaryKeyConstraint("id", name="store_price_pkey"),
        Index("store_price_unq_name", "store_id", "name", unique=True),
    )

    id = Column(BigInteger)
    store_id = Column(BigInteger, nullable=False)
    name = Column(Text, nullable=False)
    price = Column(Integer, nullable=False)
    url = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=text("now()"))
    updated_at = Column(DateTime, nullable=False, server_default=text("now()"))
    bottle_id = Column(BigInteger)

    bottle = relationship("Bottle", back_populates="store_price")
    store = relationship("Store", back_populates="store_price")
    store_price_history = relationship("StorePriceHistory", back_populates="price_")
