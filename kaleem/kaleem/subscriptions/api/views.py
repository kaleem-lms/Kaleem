from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from kaleem.subscriptions.models import SubscriptionPlan
from kaleem.subscriptions.models import UserSubscription

from .serializers import SubscriptionPlanSerializer
from .serializers import UserSubscriptionSerializer


class SubscriptionPlanList(APIView):
    def get(self, request):
        plans = SubscriptionPlan.objects.all()
        serializer = SubscriptionPlanSerializer(plans, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ActivateSubscription(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan_id = request.data.get("plan_id")
        try:
            plan = SubscriptionPlan.objects.get(id=plan_id)
        except SubscriptionPlan.DoesNotExist:
            return Response(
                {"error": "Plan does not exist."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Either create a new subscription or update an existing one.
        subscription, created = UserSubscription.objects.get_or_create(
            user=request.user,
            defaults={"plan": plan},
        )
        if not created:
            subscription.plan = plan  # Update plan if necessary.
        subscription.activate_plan()

        serializer = UserSubscriptionSerializer(subscription)
        return Response(
            {"message": "Subscription activated.", "subscription": serializer.data},
            status=status.HTTP_200_OK,
        )
