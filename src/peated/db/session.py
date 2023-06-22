from sqlalchemy import create_engine
from sqlalchemy.orm import scoped_session, sessionmaker

from peated.core.config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

Session = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))
