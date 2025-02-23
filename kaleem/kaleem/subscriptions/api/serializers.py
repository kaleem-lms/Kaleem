from rest_framework import serializers

from kaleem.subscriptions.models import SubscriptionPlan
from kaleem.subscriptions.models import UserSubscription


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = ["id", "name", "price", "duration_days", "trial_period_days"]


class UserSubscriptionSerializer(serializers.ModelSerializer):
    trial_remaining = serializers.SerializerMethodField()

    class Meta:
        model = UserSubscription
        fields = [
            "id",
            "user",
            "plan",
            "start_date",
            "end_date",
            "is_trial",
            "trial_remaining",
        ]
        read_only_fields = ["start_date", "end_date", "is_trial"]

    def get_trial_remaining(self, obj):
        return obj.trial_remaining()
