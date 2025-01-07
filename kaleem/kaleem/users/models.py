import datetime
from typing import ClassVar

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import CharField
from django.db.models import EmailField
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from .choices import Gender
from .choices import Role
from .managers import UserManager


class User(AbstractUser):
    """
    Default custom user model for Kaleem.
    """

    name = CharField(_("Name of User"), max_length=255)
    first_name = None  # type: ignore[assignment]
    last_name = None  # type: ignore[assignment]
    email = EmailField(_("Email Address"), unique=True)
    username = None  # type: ignore[assignment]
    gender = models.CharField(
        _("Gender"),
        max_length=1,
        blank=True,
        choices=Gender,
    )
    role = models.CharField(
        _("Role"),
        max_length=1,
        default=Role.Unknown,
        choices=Role,
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects: ClassVar[UserManager] = UserManager()

    def get_absolute_url(self) -> str:
        """Get URL for user's detail view."""
        return reverse("users:detail", kwargs={"pk": self.id})

    class Meta:
        verbose_name = _("User")
        verbose_name_plural = _("Users")


class Student(User):
    age = models.IntegerField(_("Age"))
    assigned_parent = models.ForeignKey(
        "Parent",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="children",
        verbose_name=_("Assigned Parent"),
    )
    assigned_teacher = models.ForeignKey(
        "Teacher",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
        verbose_name=_("Assigned Teacher"),
    )

    def save(self, *args, **kwargs) -> None:
        if self.pk is None:  # Only set for new records
            self.role = Role.Student
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = _("Student")
        verbose_name_plural = _("Students")


class Teacher(User):
    phone_number = models.CharField(
        _("Phone Number"),
        max_length=25,
        blank=True,
    )
    hire_date = models.DateField(_("Hire Date"), null=True, blank=True)
    years_of_experience = models.IntegerField(_("Years of Experience"), default=0)

    def save(self, *args, **kwargs):
        if self.hire_date:
            today = datetime.datetime.now(tz=datetime.UTC).date()
            self.years_of_experience = (
                today.year
                - self.hire_date.year
                - (
                    (today.month, today.day)
                    < (self.hire_date.month, self.hire_date.day)
                )
            )
        if self.pk is None:  # Only set for new records
            self.role = Role.Teacher
            self.is_active = False
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = _("Teacher")
        verbose_name_plural = _("Teachers")


class Parent(User):
    phone_number = models.CharField(
        _("Phone Number"),
        max_length=25,
        blank=True,
    )

    def save(self, *args, **kwargs) -> None:
        if self.pk is None:  # Only set for new records
            self.role = Role.Parent
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = _("Parent")
        verbose_name_plural = _("Parents")


class Family(models.Model):
    name = CharField(
        _("Family Name"),
        max_length=255,
    )
    guardian = models.ForeignKey(
        Parent,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="families",
        verbose_name=_("Guardian"),
    )
    created_at = models.DateTimeField(_("Created At"), auto_now_add=True)
    updated_at = models.DateTimeField(_("Updated At"), auto_now=True)

    class Meta:
        verbose_name = _("Family")
        verbose_name_plural = _("Families")

    def __str__(self) -> str:
        return self.name


class FamilyMember(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="family_members",
        verbose_name=_("User"),
    )
    family = models.ForeignKey(
        Family,
        on_delete=models.CASCADE,
        related_name="members",
        verbose_name=_("Family"),
    )
    joined_at = models.DateTimeField(_("Joined At"), auto_now_add=True)

    class Meta:
        unique_together = ("user", "family")
        verbose_name = _("Family Member")
        verbose_name_plural = _("Family Members")

    def __str__(self) -> str:
        return f"{self.user} -> {self.family}"


class UserProfile(models.Model):
    user = models.OneToOneField(
        "User",
        on_delete=models.CASCADE,
        related_name="profile",
        verbose_name=_("User"),
    )
    bio = models.TextField(_("Bio"), blank=True)
    profile_image = models.ImageField(
        _("Profile Image"),
        upload_to="profile_images/",
        default="",
    )

    class Meta:
        verbose_name = _("User Profile")
        verbose_name_plural = _("User Profiles")

    def __str__(self):
        return f"Profile of {self.user.name}"

