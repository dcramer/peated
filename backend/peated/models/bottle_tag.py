from sqlalchemy import BigInteger, Column, ForeignKeyConstraint, Integer, PrimaryKeyConstraint, String, text
from sqlalchemy.orm import relationship

from peated.db.base_class import Base


class BottleTag(Base):
    __tablename__ = "bottle_tag"
    __table_args__ = (
        ForeignKeyConstraint(["bottle_id"], ["bottle.id"], name="bottle_tag_bottle_id_bottle_id_fk"),
        PrimaryKeyConstraint("bottle_id", "tag", name="bottle_tag_bottle_id_tag"),
    )

    bottle_id = Column(BigInteger, nullable=False)
    tag = Column(String(64), nullable=False)
    count = Column(Integer, nullable=False, server_default=text("0"))

    bottle = relationship("Bottle")
