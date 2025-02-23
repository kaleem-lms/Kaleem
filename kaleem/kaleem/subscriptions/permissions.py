from rest_framework.permissions import BasePermission

from kaleem.kaleem.subscriptions.models import UserSubscription


class SubscriptionRequired(BasePermission):
    message = "Active subscription required to access this content."

    def has_permission(self, request, view):
        try:
            subscription = request.user.usersubscription
            return subscription.is_active()
        except UserSubscription.DoesNotExist:
            return False
