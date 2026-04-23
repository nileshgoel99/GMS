from django.contrib import admin

from .models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = [
        'customer_code',
        'company_legal_name',
        'country',
        'city',
        'primary_email',
        'default_currency',
        'is_active',
        'created_at',
    ]
    list_filter = ['country', 'is_active', 'default_currency']
    search_fields = ['customer_code', 'company_legal_name', 'trading_name', 'primary_email', 'tax_id_vat']
    readonly_fields = ['created_at', 'updated_at']
