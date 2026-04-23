from django.contrib import admin
from .models import InventoryItem, InventoryLog


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ['item_code', 'name', 'category', 'current_stock', 'unit', 
                    'reorder_level', 'needs_reorder', 'is_active', 'created_at']
    list_filter = ['category', 'is_active', 'color']
    search_fields = ['item_code', 'name', 'description']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(InventoryLog)
class InventoryLogAdmin(admin.ModelAdmin):
    list_display = ['item', 'transaction_type', 'quantity', 'reference_number', 
                    'stock_before', 'stock_after', 'created_at']
    list_filter = ['transaction_type', 'created_at']
    search_fields = ['item__item_code', 'item__name', 'reference_number']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'
