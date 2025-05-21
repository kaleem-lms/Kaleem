from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

User = get_user_model()


class SubscriptionPlan(models.Model):
    name = models.CharField(max_length=100)
    price = models.DecimalField(
        max_digits=8,
        decimal_places=2,
    )
    sessions_count = models.PositiveIntegerField(_("Sessions Count"))
    is_group = models.BooleanField(
        help_text="Is this a group session?",
        default=False,
    )
    duration_days = models.PositiveIntegerField(
        help_text="Duration in days for this plan",
        default=30,
    )
    session_duration = models.PositiveIntegerField(
        help_text="Duration in minutes for each session",
        default=30,
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Is this plan active?",
    )

    def __str__(self):
        return self.name


class UserSubscription(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.SET_NULL,
        null=True,
    )
    start_date = models.DateTimeField(
        default=timezone.now,
    )
    end_date = models.DateTimeField(
        null=True,
        blank=True,
    )

    # Stripe integration fields
    stripe_customer_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )
    stripe_subscription_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    def __str__(self):
        return f"{self.user.username} - {self.plan.name if self.plan else 'No Plan'}"

    def activate_plan(self):
        self.start_date = timezone.now()
        self.end_date = self.start_date + timedelta(days=self.plan.duration_days)
        self.save()

    def is_active(self):
        if self.end_date:
            return timezone.now() < self.end_date
        return False
