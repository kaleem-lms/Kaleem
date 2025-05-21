import logging

import stripe
from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import HttpResponse
from django.http import HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .models import SubscriptionPlan
from .models import UserSubscription

User = get_user_model()
logger = logging.getLogger(__name__)


@require_POST
@csrf_exempt  # Stripe doesn't send CSRF tokens, so disable it for this endpoint.
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE")
    endpoint_secret = settings.STRIPE_WEBHOOK_SECRET

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    except ValueError as e:
        # Invalid payload
        logger.error("Invalid payload: %s", e)  # noqa: TRY400
        return HttpResponseBadRequest("Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        logger.error("Invalid signature: %s", e)  # noqa: TRY400
        return HttpResponseBadRequest("Invalid signature")

    # Handle the event type
    event_type = event.get("type")
    logger.info("Received Stripe event: %s", event_type)

    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        handle_checkout_session(session)
    elif event_type == "customer.subscription.updated":
        subscription = event["data"]["object"]
        handle_subscription_update(subscription)
    elif event_type == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        handle_subscription_deletion(subscription)
    # Add other event types as needed.
    else:
        logger.info("Unhandled event type: %s", event_type)

    # Return a 200 response to acknowledge receipt of the event.
    return HttpResponse(status=200)


def handle_checkout_session(session):
    customer_email = session.get("customer_email")
    stripe_subscription_id = session.get("subscription")
    metadata = session.get("metadata", {})
    plan_id = metadata.get("plan_id")

    if not (customer_email and stripe_subscription_id):
        logger.error("Missing customer_email or subscription id in session")
        return

    try:
        user = User.objects.get(email=customer_email)
    except User.DoesNotExist:
        logger.error("User with email %s not found", customer_email)  # noqa: TRY400
        return

    user_subscription, created = UserSubscription.objects.get_or_create(user=user)
    user_subscription.stripe_subscription_id = stripe_subscription_id

    if plan_id:
        try:
            plan = SubscriptionPlan.objects.get(id=plan_id)
            user_subscription.plan = plan
        except SubscriptionPlan.DoesNotExist:
            logger.error("Plan with id %s not found", plan_id)  # noqa: TRY400

    user_subscription.activate_plan()
    user_subscription.save()
    logger.info("Checkout session processed for user: %s", user.email)


def handle_subscription_update(subscription):
    """
    Handle updates to an existing subscription.
    For example, you might update the end_date or subscription status.
    """
    stripe_subscription_id = subscription.get("id")
    try:
        user_subscription = UserSubscription.objects.get(
            stripe_subscription_id=stripe_subscription_id,
        )
    except UserSubscription.DoesNotExist:
        logger.error("Subscription with Stripe id %s not found", stripe_subscription_id)  # noqa: TRY400
        return

    # Here, you can update local fields based on the subscription's current state.
    # For example, you may want to check if the subscription is active, paused, or canceled.  # noqa: E501
    logger.info("Subscription %s updated", stripe_subscription_id)
    # Save any updates as necessary.
    user_subscription.save()


def handle_subscription_deletion(subscription):
    """
    Handle subscription cancellations or deletions.
    """
    stripe_subscription_id = subscription.get("id")
    try:
        user_subscription = UserSubscription.objects.get(
            stripe_subscription_id=stripe_subscription_id,
        )
    except UserSubscription.DoesNotExist:
        logger.error("Subscription with Stripe id %s not found", stripe_subscription_id)  # noqa: TRY400
        return

    # Mark the subscription as inactive or update end_date.
    # For example:
    user_subscription.end_date = (
        None  # or set to current time, or implement custom logic
    )
    user_subscription.save()
    logger.info("Subscription %s cancelled or deleted", stripe_subscription_id)
