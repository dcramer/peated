from geoalchemy2 import Geometry
from sqlalchemy import (
    ARRAY,
    BigInteger,
    Column,
    DateTime,
    Enum,
    ForeignKeyConstraint,
    Index,
    PrimaryKeyConstraint,
    Text,
    text,
)

from peated.db.base import Base


class Entity(Base):
    __tablename__ = "entity"
    __table_args__ = (
        ForeignKeyConstraint(["created_by_id"], ["user.id"], name="entity_created_by_id_user_id_fk"),
        PrimaryKeyConstraint("id", name="entity_pkey"),
        Index("entity_name_unq", "name", unique=True),
    )

    id = Column(BigInteger)
    name = Column(Text, nullable=False)
    type = Column(
        ARRAY(
            Enum(
                "brand",
                "distiller",
                "bottler",
                name="entity_type",
                _create_events=False,
            )
        ),
        nullable=False,
    )
    created_at = Column(DateTime, nullable=False, server_default=text("now()"))
    created_by_id = Column(BigInteger, nullable=False)
    total_bottles = Column(BigInteger, nullable=False, server_default=text("0"))
    total_tastings = Column(BigInteger, nullable=False, server_default=text("0"))
    country = Column(Text)
    region = Column(Text)
    location = Column(Geometry(geometry_type="POINT", srid=4326))
