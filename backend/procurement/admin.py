from django.contrib import admin
from .models import PurchaseOrder, PurchaseOrderItem, POReceipt, POReceiptItem


class PurchaseOrderItemInline(admin.TabularInline):
    model = PurchaseOrderItem
    extra = 1


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ['po_number', 'vendor_name', 'order_date', 'status', 'total_amount', 'created_at']
    list_filter = ['status', 'order_date']
    search_fields = ['po_number', 'vendor_name', 'vendor_email']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [PurchaseOrderItemInline]
    date_hierarchy = 'order_date'


class POReceiptItemInline(admin.TabularInline):
    model = POReceiptItem
    extra = 1


@admin.register(POReceipt)
class POReceiptAdmin(admin.ModelAdmin):
    list_display = ['receipt_number', 'po', 'receipt_date', 'created_at']
    list_filter = ['receipt_date']
    search_fields = ['receipt_number', 'po__po_number']
    readonly_fields = ['created_at']
    inlines = [POReceiptItemInline]
    date_hierarchy = 'receipt_date'
