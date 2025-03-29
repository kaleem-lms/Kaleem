from django.db import models


class ChatGroupStatusChoices(models.TextChoices):
    ACTIVE = "active", "Active"
    ARCHIVED = "archived", "Archived"


class GroupMemberRoleChoices(models.TextChoices):
    MEMBER = "member", "Member"
    ADMIN = "admin", "Admin"
    OWNER = "owner", "Owner"


class GroupMemberStatusChoices(models.TextChoices):
    ACTIVE = "active", "Active"
    REMOVED = "removed", "Removed"
    BANNED = "banned", "Banned"


class ChatMessageMediaTypeChoices(models.TextChoices):
    TEXT = "text", "Text"
    IMAGE = "image", "Image"
    VIDEO = "video", "Video"
    AUDIO = "audio", "Audio"
    FILE = "file", "File"


class ChatMessageStatusChoices(models.TextChoices):
    ACTIVE = "active", "Active"
    FLAGGED = "flagged", "Flagged"
    DELETED = "deleted", "Deleted"
