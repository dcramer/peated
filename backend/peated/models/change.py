from sqlalchemy import BigInteger, Column, DateTime, Enum, ForeignKeyConstraint, PrimaryKeyConstraint, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from peated.db.base_class import Base


class Change(Base):
    __tablename__ = "change"
    __table_args__ = (
        ForeignKeyConstraint(["created_by_id"], ["user.id"], name="change_created_by_id_user_id_fk"),
        PrimaryKeyConstraint("id", name="change_pkey"),
    )

    id = Column(BigInteger)
    object_id = Column(BigInteger, nullable=False)
    object_type = Column(
        Enum(
            "bottle",
            "edition",
            "entity",
            "tasting",
            "toast",
            "follow",
            "comment",
            name="object_type",
        ),
        nullable=False,
    )
    data = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    created_at = Column(DateTime, nullable=False, server_default=text("now()"))
    created_by_id = Column(BigInteger, nullable=False)
    type = Column(
        Enum("add", "update", "delete", name="type"),
        nullable=False,
        server_default=text("'add'::type"),
    )
    display_name = Column(Text)

    created_by = relationship("User")
