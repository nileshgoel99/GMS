from django.contrib import admin

from .audit import diff_snapshots, record_item_audit, snapshot_item
from .models import InventoryItem, InventoryItemAudit, InventoryLog


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ['item_code', 'name', 'category', 'current_stock', 'unit',
                    'reorder_level', 'needs_reorder', 'is_active', 'created_at']
    list_filter = ['category', 'is_active', 'color']
    search_fields = ['item_code', 'name', 'description']
    readonly_fields = ['created_at', 'updated_at']

    def save_model(self, request, obj, form, change):
        before = snapshot_item(InventoryItem.objects.get(pk=obj.pk)) if change and obj.pk else None
        super().save_model(request, obj, form, change)
        if before:
            changes = diff_snapshots(before, snapshot_item(obj))
            if changes:
                record_item_audit(item=obj, action='UPDATE', user=request.user, changes=changes)

    def delete_model(self, request, obj):
        record_item_audit(item=obj, action='DELETE', user=request.user, changes=snapshot_item(obj))
        obj.is_active = False
        obj.save(update_fields=['is_active', 'updated_at'])

    def delete_queryset(self, request, queryset):
        for obj in queryset:
            self.delete_model(request, obj)


@admin.register(InventoryLog)
class InventoryLogAdmin(admin.ModelAdmin):
    list_display = ['item', 'transaction_type', 'quantity', 'reference_number',
                    'stock_before', 'stock_after', 'created_at']
    list_filter = ['transaction_type', 'created_at']
    search_fields = ['item__item_code', 'item__name', 'reference_number']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'


@admin.register(InventoryItemAudit)
class InventoryItemAuditAdmin(admin.ModelAdmin):
    list_display = ['item_code', 'action', 'performed_by', 'performed_at']
    list_filter = ['action', 'performed_at']
    search_fields = ['item_code', 'item_name', 'performed_by__username']
    readonly_fields = [
        'item', 'item_code', 'item_name', 'action', 'changes',
        'performed_by', 'performed_at',
    ]
    date_hierarchy = 'performed_at'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
