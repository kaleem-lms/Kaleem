from django.contrib import admin

from .models import TimeSlot, SessionSlot

admin.site.register(TimeSlot)
admin.site.register(SessionSlot)
