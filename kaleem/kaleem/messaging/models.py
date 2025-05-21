from django.db import models

from kaleem.users.models import UserProfile

from .choices import ChatGroupStatusChoices
from .choices import ChatMessageMediaTypeChoices
from .choices import ChatMessageStatusChoices
from .choices import GroupMemberRoleChoices
from .choices import GroupMemberStatusChoices


class ChatGroup(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(default="")
    author = models.ForeignKey(
        UserProfile,
        on_delete=models.CASCADE,
    )
    status = models.CharField(
        max_length=10,
        choices=ChatGroupStatusChoices.choices,
        default=ChatGroupStatusChoices.ACTIVE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.status})"


class ChatGroupMember(models.Model):
    group = models.ForeignKey(
        ChatGroup,
        on_delete=models.CASCADE,
    )
    user = models.ForeignKey(
        UserProfile,
        on_delete=models.CASCADE,
    )
    role = models.CharField(
        max_length=10,
        choices=GroupMemberRoleChoices.choices,
        default=GroupMemberRoleChoices.MEMBER,
    )
    status = models.CharField(
        max_length=10,
        choices=GroupMemberStatusChoices.choices,
        default=GroupMemberStatusChoices.ACTIVE,
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    left_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} - {self.group} - {self.role} ({self.status})"


class ChatMessage(models.Model):
    content = models.TextField()
    author = models.ForeignKey(
        UserProfile,
        on_delete=models.CASCADE,
    )
    group = models.ForeignKey(
        ChatGroup,
        on_delete=models.CASCADE,
    )
    message_type = models.CharField(
        max_length=10,
        choices=ChatMessageMediaTypeChoices.choices,
        default=ChatMessageMediaTypeChoices.TEXT,
    )
    status = models.CharField(
        max_length=10,
        choices=ChatMessageStatusChoices.choices,
    )
    seen_count = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.author} - {self.group} - {self.message_type} ({self.status})"



class ChatMessageMedia(models.Model):
    message = models.ForeignKey(
        ChatMessage,
        on_delete=models.CASCADE,
    )
    media = models.FileField(
        upload_to="chat/messages/",
        max_length=100,
    )
    media_type = models.CharField(
        max_length=10,
        choices=ChatMessageMediaTypeChoices.choices,
        default=ChatMessageMediaTypeChoices.IMAGE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.message} - {self.media_type}"
