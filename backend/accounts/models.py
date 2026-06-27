from django.contrib.auth.models import User
from django.db import models


class Role(models.Model):
    """Configurable role with module permissions."""
    code = models.CharField(max_length=40, unique=True, db_index=True)
    name = models.CharField(max_length=80)
    description = models.TextField(blank=True, default='')
    modules = models.JSONField(default=list, blank=True, help_text='List of module keys this role can access')
    is_admin = models.BooleanField(default=False, help_text='Full access to all modules')
    is_system = models.BooleanField(default=False, help_text='Built-in role — cannot be deleted')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name='users')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['user__username']

    def __str__(self):
        return f'{self.user.username} ({self.role.name})'

    @property
    def role_label(self):
        return self.role.name

    @property
    def role_code(self):
        return self.role.code
