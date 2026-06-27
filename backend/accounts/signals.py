from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Role, UserProfile


def _default_role():
    return (
        Role.objects.filter(code='MERCHANDISER').first()
        or Role.objects.filter(is_admin=True).first()
        or Role.objects.first()
    )


@receiver(post_save, sender=User)
def ensure_user_profile(sender, instance, created, **kwargs):
    if created:
        role = Role.objects.filter(is_admin=True).first() if instance.is_superuser else _default_role()
        UserProfile.objects.create(user=instance, role=role)
    elif not hasattr(instance, 'profile'):
        role = Role.objects.filter(is_admin=True).first() if instance.is_superuser else _default_role()
        UserProfile.objects.create(user=instance, role=role)
