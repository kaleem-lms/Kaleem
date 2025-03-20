import stripe
from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from kaleem.subscriptions.models import SubscriptionPlan
from kaleem.subscriptions.models import UserSubscription

from .serializers import SubscriptionPlanSerializer
from .serializers import UserSubscriptionSerializer


class SubscriptionPlanList(APIView):
    permission_classes = (AllowAny,)

    def get(self, request):
        plans = SubscriptionPlan.objects.filter(is_active=True)
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


class CheckoutSessionViewSet(viewsets.ViewSet):
    permission_classes = (IsAuthenticated,)

    @action(detail=False, methods=["post"], url_path="create")
    def create_checkout_session(self, request):
        """
        Create a Stripe Checkout Session for a subscription plan.
        """
        plan_id = request.data.get("plan_id")
        if not plan_id:
            return Response(
                {"error": "Plan id not provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Retrieve the SubscriptionPlan object or return 404 if not found.
        subscription_plan = get_object_or_404(SubscriptionPlan, id=plan_id)

        try:
            # Create a Stripe Checkout Session in subscription mode.
            checkout_session = stripe.checkout.Session.create(
                api_key=settings.STRIPE_SECRET_KEY,
                payment_method_types=["card"],
                mode="subscription",
                customer_email=request.user.email,
                line_items=[
                    {
                        "price_data": {
                            "currency": "eur",
                            "product_data": {
                                "name": subscription_plan.name,
                            },
                            # Amount is in cents
                            "unit_amount": int(subscription_plan.price * 100),
                            "recurring": {
                                "interval": "month",
                            },
                        },
                        "quantity": 1,
                    },
                ],
                # These URLs should be set in your Django settings.
                success_url=settings.STRIPE_SUCCESS_URL
                + "?session_id={CHECKOUT_SESSION_ID}",
                cancel_url=settings.STRIPE_CANCEL_URL,
                metadata={"plan_id": subscription_plan.id},
            )
            # Return the session id to the client so they can redirect.
            return Response(
                {"sessionId": checkout_session.id},
                status=status.HTTP_200_OK,
            )
        except Exception as e:  # noqa: BLE001
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
