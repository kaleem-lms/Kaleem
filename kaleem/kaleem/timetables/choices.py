from django.db import models


class Weekday(models.IntegerChoices):
    SATURDAY = 0
    SUNDAY = 1
    MONDAY = 2
    TUESDAY = 3
    WEDNESDAY = 4
    THURSDAY = 5
    FRIDAY = 6


class SessionStatus(models.TextChoices):
    SCHEDULED = "Scheduled"
    JOINED = "Joined"
    COMPLETED = "Completed"
    MISSED = "Missed"
    CANCELLED = "Cancelled"
