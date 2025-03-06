from django.urls import path

from kaleem.subscriptions.api.views import ActivateSubscription
from kaleem.subscriptions.api.views import SubscriptionPlanList

app_name = "subscriptions"

urlpatterns = [
    # List all subscription plans available.
    path(
        "subscriptions/plans/",
        SubscriptionPlanList.as_view(),
        name="subscription_plans",
    ),
    # Activate a subscription for the authenticated user.
    path(
        "subscriptions/activate/",
        ActivateSubscription.as_view(),
        name="activate_subscription",
    ),
]
