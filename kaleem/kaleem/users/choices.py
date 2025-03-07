from django.db import models


class Gender(models.TextChoices):
    MALE = "M"
    FEMALE = "F"


class Role(models.TextChoices):
    Unknown = "U"
    Student = "S"
    Teacher = "T"
    Parent = "P"
