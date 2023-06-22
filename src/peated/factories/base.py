from factory import alchemy

from peated.db.session import Session


class ModelFactory(alchemy.SQLAlchemyModelFactory):
    class Meta:
        sqlalchemy_session = Session
        sqlalchemy_session_persistence = "commit"
