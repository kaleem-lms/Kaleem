from django.contrib.auth import get_user_model
from django.db import models

from .choices import ResourceTypes

User = get_user_model()


class ResourceCategory(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(
        blank=True,
        default="",
    )

    def __str__(self):
        return self.name


class Resource(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(
        blank=True,
        default="",
    )
    category = models.ForeignKey(
        ResourceCategory,
        related_name="resources",
        on_delete=models.CASCADE,
    )
    resource_type = models.CharField(
        max_length=10,
        choices=ResourceTypes.choices,
    )
    file = models.FileField(
        upload_to="resources/",
        blank=True,
        null=True,
    )
    video_url = models.URLField(
        blank=True,
        default="",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class AssignedResource(models.Model):
    teacher = models.ForeignKey(
        User,
        related_name="assigned_resources",
        on_delete=models.CASCADE,
    )
    student = models.ForeignKey(
        User,
        related_name="resources_assigned",
        on_delete=models.CASCADE,
    )
    resource = models.ForeignKey(
        Resource,
        on_delete=models.CASCADE,
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.resource.title} assigned by {self.teacher.username} to {self.student.username}"  # noqa: E501
