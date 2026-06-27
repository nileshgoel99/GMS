from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.models import User

from .models import Role, UserProfile


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'is_admin', 'is_system', 'user_count')
    list_filter = ('is_admin', 'is_system')
    search_fields = ('name', 'code')
    readonly_fields = ('is_system', 'created_at', 'updated_at')

    @admin.display(description='Users')
    def user_count(self, obj):
        return obj.users.count()


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    extra = 0


class UserAdmin(DjangoUserAdmin):
    inlines = [UserProfileInline]
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_active', 'profile_role', 'is_staff')
    list_filter = DjangoUserAdmin.list_filter + ('profile__role',)

    @admin.display(description='Role')
    def profile_role(self, obj):
        if obj.is_superuser:
            return 'Admin (superuser)'
        return obj.profile.role.name if hasattr(obj, 'profile') and obj.profile.role_id else '—'


admin.site.unregister(User)
admin.site.register(User, UserAdmin)
