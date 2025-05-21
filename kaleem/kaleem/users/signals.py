from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Parent
from .models import Student
from .models import Teacher
from .models import UserProfile


@receiver(post_save, sender=Student)
@receiver(post_save, sender=Parent)
@receiver(post_save, sender=Teacher)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
