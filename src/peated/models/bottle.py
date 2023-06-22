from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    Enum,
    ForeignKeyConstraint,
    Index,
    PrimaryKeyConstraint,
    SmallInteger,
    String,
    text,
)

from peated.db.base import Base


class Bottle(Base):
    __tablename__ = "bottle"
    __table_args__ = (
        ForeignKeyConstraint(["bottler_id"], ["entity.id"], name="bottle_bottler_id_entity_id_fk"),
        ForeignKeyConstraint(["brand_id"], ["entity.id"], name="bottle_brand_id_entity_id_fk"),
        ForeignKeyConstraint(["created_by_id"], ["user.id"], name="bottle_created_by_id_user_id_fk"),
        PrimaryKeyConstraint("id", name="bottle_pkey"),
        Index("bottle_brand_unq", "name", "brand_id", unique=True),
        Index("bottle_name_unq", "full_name", unique=True),
    )

    id = Column(BigInteger)
    name = Column(String(255), nullable=False)
    brand_id = Column(BigInteger, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=text("now()"))
    created_by_id = Column(BigInteger, nullable=False)
    total_tastings = Column(BigInteger, nullable=False, server_default=text("0"))
    full_name = Column(String(255), nullable=False)
    category = Column(
        Enum(
            "blend",
            "bourbon",
            "rye",
            "single_grain",
            "single_malt",
            "spirit",
            name="category",
        )
    )
    stated_age = Column(SmallInteger)
    bottler_id = Column(BigInteger)
