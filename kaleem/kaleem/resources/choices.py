from django.db import models
from django.utils.translation import gettext_lazy as _


class ResourceTypes(models.TextChoices):
    FILE = "file", _("File")
    VIDEO = "video", _("Video")
    DOCUMENT = "document", _("Document")
