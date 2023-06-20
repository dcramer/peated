from sqlalchemy import (
    ARRAY,
    BigInteger,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKeyConstraint,
    Index,
    Integer,
    PrimaryKeyConstraint,
    String,
    Text,
    text,
)
from sqlalchemy.orm import relationship

from peated.db.base_class import Base


class Tasting(Base):
    __tablename__ = "tasting"
    __table_args__ = (
        ForeignKeyConstraint(
            ["bottle_id"], ["bottle.id"], name="tasting_bottle_id_bottle_id_fk"
        ),
        ForeignKeyConstraint(
            ["created_by_id"], ["user.id"], name="tasting_created_by_id_user_id_fk"
        ),
        PrimaryKeyConstraint("id", name="tasting_pkey"),
        Index("tasting_unq", "bottle_id", "created_by_id", "created_at", unique=True),
    )

    id = Column(BigInteger)
    bottle_id = Column(BigInteger, nullable=False)
    tags = Column(
        ARRAY(String(length=64)),
        nullable=False,
        server_default=text("ARRAY[]::character varying[]"),
    )
    created_at = Column(DateTime, nullable=False, server_default=text("now()"))
    created_by_id = Column(BigInteger, nullable=False)
    toasts = Column(Integer, nullable=False, server_default=text("0"))
    comments = Column(Integer, nullable=False, server_default=text("0"))
    notes = Column(Text)
    rating = Column(Float(53))
    image_url = Column(Text)
    serving_style = Column(Enum("neat", "rocks", "splash", name="servingStyle"))

    bottle = relationship("Bottle", back_populates="tasting")
    created_by = relationship("User", back_populates="tasting")
    comments_ = relationship("Comments", back_populates="tasting")
