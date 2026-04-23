from django.contrib import admin
from .models import (
    ProformaInvoice,
    ProformaInvoiceLine,
    PlanningSheet,
    Intent,
    IntentSheet,
    IntentLine,
    IntentAttachment,
)


class ProformaInvoiceLineInline(admin.TabularInline):
    model = ProformaInvoiceLine
    extra = 0


class IntentLineInline(admin.TabularInline):
    model = IntentLine
    fk_name = 'sheet'
    extra = 0
    fields = [
        'line_number', 'material_description', 'variant', 'consumption_per_unit', 'unit',
        'total_required', 'inventory_item', 'remarks',
    ]


class IntentSheetInline(admin.StackedInline):
    model = IntentSheet
    extra = 0
    show_change_link = True
    fields = ['label', 'sort_order', 'item_description', 'total_garment_qty']


@admin.register(Intent)
class IntentAdmin(admin.ModelAdmin):
    list_display = ['indent_number', 'pi', 'intent_date', 'status', 'total_garment_qty', 'created_at']
    list_filter = ['status', 'intent_date']
    search_fields = ['indent_number', 'buyer_po_reference', 'pi__pi_number']
    inlines = [IntentSheetInline]
    date_hierarchy = 'intent_date'


@admin.register(IntentSheet)
class IntentSheetAdmin(admin.ModelAdmin):
    list_display = ['label', 'intent', 'sort_order', 'total_garment_qty', 'created_at']
    list_filter = ['intent__status']
    search_fields = ['label', 'intent__indent_number']
    inlines = [IntentLineInline]
    raw_id_fields = ['intent']


@admin.register(IntentAttachment)
class IntentAttachmentAdmin(admin.ModelAdmin):
    list_display = ['intent', 'description', 'uploaded_at']
    search_fields = ['intent__indent_number']


@admin.register(ProformaInvoice)
class ProformaInvoiceAdmin(admin.ModelAdmin):
    list_display = ['pi_number', 'buyer_po_number', 'customer', 'client_name', 'quantity', 'status', 'order_date', 'created_at']
    list_filter = ['status', 'order_date']
    search_fields = ['pi_number', 'client_name', 'client_email', 'buyer_po_number']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [ProformaInvoiceLineInline]
    date_hierarchy = 'order_date'


@admin.register(PlanningSheet)
class PlanningSheetAdmin(admin.ModelAdmin):
    list_display = ['pi', 'created_at', 'updated_at']
    search_fields = ['pi__pi_number']
    readonly_fields = ['created_at', 'updated_at']
