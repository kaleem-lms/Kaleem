from django.db import models

from kaleem.users.models import Student
from kaleem.users.models import Teacher

from .choices import SessionStatus
from .choices import Weekday


class TimeSlot(models.Model):
    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.CASCADE,
        related_name="time_slots",
    )
    day_of_week = models.IntegerField(choices=Weekday)
    is_free = models.BooleanField(default=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    student = models.ForeignKey(
        Student,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="time_slots",
    )

    def __str__(self):
        status = "Free" if self.is_free else f"Occupied by {self.student}"
        return f"{self.teacher.name}: {self.day_of_week} {self.start_time}-{self.end_time} ({status})"  # noqa: E501

    @staticmethod
    def occupy_time(*, teacher, student, day_of_week, start_time, end_time):
        """
        Occupy a specific time range for a teacher on a given day.
        Ensures overlapping slots are split properly and the range is occupied.
        """
        overlapping_slots = TimeSlot.objects.filter(
            teacher=teacher,
            day_of_week=day_of_week,
            start_time__lt=end_time,
            end_time__gt=start_time,
            is_free=True,
        )

        if not overlapping_slots.exists():
            raise ValueError("No free time slots available for this range.")

        for slot in overlapping_slots:
            # Case: Slot fully contains the requested range
            if slot.start_time < start_time and slot.end_time > end_time:
                # Create the "before" slot
                TimeSlot.objects.create(
                    teacher=teacher,
                    day_of_week=day_of_week,
                    start_time=slot.start_time,
                    end_time=start_time,
                    is_free=True,
                )
                # Create the "after" slot
                TimeSlot.objects.create(
                    teacher=teacher,
                    day_of_week=day_of_week,
                    start_time=end_time,
                    end_time=slot.end_time,
                    is_free=True,
                )
                # Update the current slot to be the "occupied" slot
                slot.start_time = start_time
                slot.end_time = end_time
                slot.is_free = False
                slot.student = student
                slot.save()

            # Case: Slot fully overlaps the requested range
            elif slot.start_time >= start_time and slot.end_time <= end_time:
                slot.is_free = False
                slot.student = student
                slot.save()

            # Case: Slot partially overlaps at the start
            elif slot.start_time < start_time and slot.end_time > start_time:
                TimeSlot.objects.create(
                    teacher=teacher,
                    day_of_week=day_of_week,
                    start_time=slot.start_time,
                    end_time=start_time,
                    is_free=True,
                )
                slot.start_time = start_time
                slot.is_free = False
                slot.student = student
                slot.save()

            # Case: Slot partially overlaps at the end
            elif slot.start_time < end_time and slot.end_time > end_time:
                TimeSlot.objects.create(
                    teacher=teacher,
                    day_of_week=day_of_week,
                    start_time=end_time,
                    end_time=slot.end_time,
                    is_free=True,
                )
                slot.end_time = end_time
                slot.is_free = False
                slot.student = student
                slot.save()


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
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    status = models.CharField(
        max_length=20,
        choices=SessionStatus,
        default=SessionStatus.SCHEDULED,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    zoom_meeting_id = models.CharField(max_length=255, default="")
    zoom_meeting_link = models.URLField(max_length=500, default="")

    def __str__(self):
        return f"Session on {self.date} ({self.teacher}) - {self.status}"
