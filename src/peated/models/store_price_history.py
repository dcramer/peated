from sqlalchemy import BigInteger, Column, Date, ForeignKeyConstraint, Index, Integer, PrimaryKeyConstraint, text

from peated.db.base import Base


class StorePriceHistory(Base):
    __tablename__ = "store_price_history"
    __table_args__ = (
        ForeignKeyConstraint(
            ["price_id"],
            ["store_price.id"],
            name="store_price_history_price_id_store_price_id_fk",
        ),
        PrimaryKeyConstraint("id", name="store_price_history_pkey"),
        Index("store_price_history_unq", "price_id", "date", unique=True),
    )

    id = Column(BigInteger)
    price_id = Column(BigInteger, nullable=False)
    price = Column(Integer, nullable=False)
    date = Column(Date, nullable=False, server_default=text("now()"))
