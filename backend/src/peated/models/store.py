from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    Enum,
    Index,
    PrimaryKeyConstraint,
    Text,
    text,
)
from sqlalchemy.orm import relationship

from peated.db.base_class import Base


class Store(Base):
    __tablename__ = "store"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="store_pkey"),
        Index("store_type", "type", unique=True),
    )

    id = Column(BigInteger)
    type = Column(
        Enum("totalwines", "woodencork", "astorwines", name="price_scraper_type"),
        nullable=False,
    )
    name = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=text("now()"))
    last_run_at = Column(DateTime)
    country = Column(Text)

    store_price = relationship("StorePrice", back_populates="store")
