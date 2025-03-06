from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone

User = get_user_model()


class SubscriptionPlan(models.Model):
    name = models.CharField(max_length=100)
    price = models.DecimalField(
        max_digits=8,
        decimal_places=2,
    )
    duration_days = models.PositiveIntegerField(
        help_text="Duration in days for this plan",
        default=30,
    )
    trial_period_days = models.PositiveIntegerField(
        default=0,
        help_text="Trial period in days for new users",
    )

    def __str__(self):
        return self.name


class UserSubscription(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.SET_NULL, null=True)
    start_date = models.DateTimeField(default=timezone.now)
    end_date = models.DateTimeField(null=True, blank=True)
    is_trial = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.user.username} - {self.plan.name if self.plan else 'No Plan'}"

    def activate_plan(self):
        self.start_date = timezone.now()
        self.end_date = self.start_date + timedelta(days=self.plan.duration_days)
        self.is_trial = self.plan.trial_period_days > 0
        self.save()

    def trial_remaining(self):
        if self.is_trial and self.start_date:
            trial_end = self.start_date + timedelta(days=self.plan.trial_period_days)
            remaining = (trial_end - timezone.now()).days
            return max(remaining, 0)
        return 0

    def is_active(self):
        if self.end_date:
            return timezone.now() < self.end_date
        return False
