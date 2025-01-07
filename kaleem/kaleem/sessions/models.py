import datetime

from django.contrib.postgres.fields import DateTimeRangeField
from django.db import models

from kaleem.users.models import Student
from kaleem.users.models import Teacher

from .choices import SessionStatus
from .choices import Weekday


class TeacherWeekdayTimetable(models.Model):
    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.CASCADE,
        related_name="time_ranges",
    )
    weekday = models.IntegerField(choices=Weekday)

    class Meta:
        unique_together = ("teacher", "weekday")


class TeacherOccupiedTimeRange(models.Model):
    teacher_weekday_timetable = models.ForeignKey(
        TeacherWeekdayTimetable,
        on_delete=models.CASCADE,
        related_name="occupied_times",
    )
    time_range = DateTimeRangeField()

    class Meta:
        unique_together = ("teacher_weekday_timetable", "time_range")

    def save(self, *args, **kwargs):
        # Set a fixed date (1999-01-01) for the range, but only use the time component
        fixed_date = "1999-01-01"
        lower_time = self.time_range.lower
        upper_time = self.time_range.upper

        # Combine the fixed date with the time range values
        self.time_range = (
            datetime.combine(
                datetime.strptime(fixed_date, "%Y-%m-%d").date(),
                lower_time,
            ),
            datetime.combine(
                datetime.strptime(fixed_date, "%Y-%m-%d").date(),
                upper_time,
            ),
        )
        super().save(*args, **kwargs)


class SessionSlot(models.Model):
    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.CASCADE,
        related_name="session_slots",
    )
    students = models.ManyToManyField(
        Student,
        related_name="session_slots",
    )
    start_time = models.TimeField()
    end_time = models.TimeField()
    # teacher = models.ForeignKey(
    #     Teacher,
    #     on_delete=models.CASCADE,
    #     related_name="sessions",
    # )
    # date = models.DateField()
    # students = models.ManyToManyField(
    #     Student,
    #     related_name="sessions",
    # )
    # status = models.CharField(
    #     max_length=20,
    #     choices=SessionStatus,
    #     default=SessionStatus.SCHEDULED,
    # )
    # created_at = models.DateTimeField(auto_now_add=True)

    # def __str__(self):
    #     return f"Session on {self.date} ({self.timetable}) - {self.status}"
