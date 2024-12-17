from django.contrib.auth import get_user_model
from django.db import models

from kaleem.users.models import Student

from .choices import CurriculumContentType

User = get_user_model()


class Curriculum(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class Content(models.Model):
    curriculum = models.ForeignKey(
        Curriculum,
        on_delete=models.CASCADE,
        related_name="contents",
    )
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True, default="")
    content_type = models.CharField(
        max_length=20,
        choices=CurriculumContentType.choices,
        default=CurriculumContentType.TEXT,
    )
    file = models.FileField(
        upload_to="content_files/",
        blank=True,
        null=True,
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.curriculum.title} - {self.title}"


class CurriculumContentAccess(models.Model):
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="curriculum_access",
    )
    content = models.ForeignKey(
        Content,
        on_delete=models.CASCADE,
        related_name="student_access",
    )
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("student", "content")

    def __str__(self):
        return f"{self.student.username} - {self.curriculum.title}"
