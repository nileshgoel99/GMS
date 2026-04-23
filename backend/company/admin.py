from django.contrib import admin

from .models import CompanyProfile


@admin.register(CompanyProfile)
class CompanyProfileAdmin(admin.ModelAdmin):
    list_display = ('legal_name', 'email', 'phone', 'updated_at')
    readonly_fields = ('updated_at',)
