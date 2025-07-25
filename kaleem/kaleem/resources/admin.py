from django.contrib import admin

from .models import AssignedResource
from .models import Resource
from .models import ResourceCategory

admin.site.register(Resource)
admin.site.register(ResourceCategory)
admin.site.register(AssignedResource)
