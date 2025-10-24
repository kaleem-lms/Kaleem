from django.core.validators import MaxValueValidator
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _


class StudentSessionReport(models.Model):
    student = models.ForeignKey(
        "users.Student",
        verbose_name=_("Student"),
        on_delete=models.CASCADE,
        related_name="student_reports",
    )
    session_slot = models.ForeignKey(
        "timetables.SessionSlot",
        verbose_name=_("Session"),
        on_delete=models.CASCADE,
        related_name="session_reports",
    )
    created_at = models.DateTimeField(_("Created At"), auto_now_add=True)
    content = models.JSONField(_("Content"))
    rate = models.IntegerField(
        _("Rate"),
        help_text=_("Rate from 1 to 5"),
        validators=[
            MinValueValidator(1),
            MaxValueValidator(5),
        ],
    )

    def __str__(self):
        return (
            f"{self.student} - {self.session_slot.teacher} - {self.session_slot} - {self.created_at}"
        )
