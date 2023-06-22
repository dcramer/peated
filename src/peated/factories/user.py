import factory

from peated import models

from .base import ModelFactory


class UserFactory(ModelFactory):
    username = factory.Faker("word")
    email = factory.Faker("email")
    display_name = factory.Faker("name")

    class Meta:
        model = models.User
