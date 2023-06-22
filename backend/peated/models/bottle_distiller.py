from sqlalchemy import BigInteger, Column, ForeignKeyConstraint, PrimaryKeyConstraint

from peated.db.base_class import Base


class BottleDistiller(Base):
    __tablename__ = "bottle_distiller"
    __table_args__ = (
        ForeignKeyConstraint(["bottle_id"], ["bottle.id"], name="bottle_distiller_bottle_id_bottle_id_fk"),
        ForeignKeyConstraint(
            ["distiller_id"],
            ["entity.id"],
            name="bottle_distiller_distiller_id_entity_id_fk",
        ),
        PrimaryKeyConstraint("bottle_id", "distiller_id", name="bottle_distiller_bottle_id_distiller_id"),
    )

    bottle_id = Column(BigInteger, nullable=False)
    distiller_id = Column(BigInteger, nullable=False)
