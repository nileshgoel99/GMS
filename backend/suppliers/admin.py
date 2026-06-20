from django.contrib import admin

from .models import Supplier


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ['name', 'country', 'contact_person', 'gst', 'is_international', 'is_active', 'created_at']
    list_filter = ['country', 'is_international', 'is_active']
    search_fields = ['name', 'address', 'gst', 'country', 'contact_person', 'email', 'phone']
    readonly_fields = ['created_at', 'updated_at']
