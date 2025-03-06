from django.contrib import admin

from .models import SubscriptionPlan
from .models import UserSubscription

admin.site.register(SubscriptionPlan)
admin.site.register(UserSubscription)
