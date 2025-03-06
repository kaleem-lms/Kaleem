from django.db import models


class CurriculumContentType(models.TextChoices):
    TEXT = "TEXT", "Text"
    VIDEO = "VIDEO", "Video"
    PDF = "PDF", "PDF"
    OTHER = "OTHER", "Other"
