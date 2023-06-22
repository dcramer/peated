from sqlalchemy import (
    BigInteger,
    Column,
    Enum,
    ForeignKeyConstraint,
    Index,
    PrimaryKeyConstraint,
    Text,
)
from sqlalchemy.orm import relationship

from peated.db.base_class import Base


class Identity(Base):
    __tablename__ = "identity"
    __table_args__ = (
        ForeignKeyConstraint(["user_id"], ["user.id"], name="identity_user_id_user_id_fk"),
        PrimaryKeyConstraint("id", name="identity_pkey"),
        Index("identity_unq", "provider", "external_id", unique=True),
    )

    id = Column(BigInteger)
    provider = Column(Enum("google", name="identity_provider"), nullable=False)
    external_id = Column(Text, nullable=False)
    user_id = Column(BigInteger, nullable=False)

    user = relationship("User", back_populates="identity")
