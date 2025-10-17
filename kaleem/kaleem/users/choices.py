from django.db import models


class Gender(models.TextChoices):
    MALE = "M"
    FEMALE = "F"


class Role(models.TextChoices):
    Unknown = "U"
    Admin = "A"
    Student = "S"
    Teacher = "T"
    Parent = "P"
