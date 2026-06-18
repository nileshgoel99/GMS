from django.contrib import admin
from .models import (
    ProformaInvoice,
    ProformaInvoiceLine,
    TrimMaster,
    Indent,
    IndentFabricLine,
    IndentTrimLine,
    ItemIndentTemplate,
    BuyerPO,
    BuyerPOLine,
)


class ProformaInvoiceLineInline(admin.TabularInline):
    model = ProformaInvoiceLine
    extra = 0


class IndentFabricLineInline(admin.TabularInline):
    model = IndentFabricLine
    extra = 0
    fields = ['sort_order', 'material', 'color', 'consumption_per_pc', 'unit', 'total_consumption', 'remarks']


class IndentTrimLineInline(admin.TabularInline):
    model = IndentTrimLine
    extra = 0
    fields = ['sort_order', 'trim_name', 'category', 'color_variant', 'size_variant', 'consumption_per_pc', 'unit', 'total_consumption', 'total_unit', 'remarks']


@admin.register(TrimMaster)
class TrimMasterAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'default_unit', 'created_at']
    list_filter = ['category']
    search_fields = ['name', 'category']


@admin.register(Indent)
class IndentAdmin(admin.ModelAdmin):
    list_display = ['indent_number', 'pi', 'indent_date', 'status', 'created_at']
    list_filter = ['status', 'indent_date']
    search_fields = ['indent_number', 'pi__pi_number']
    inlines = [IndentFabricLineInline, IndentTrimLineInline]
    date_hierarchy = 'indent_date'


@admin.register(ItemIndentTemplate)
class ItemIndentTemplateAdmin(admin.ModelAdmin):
    list_display = ['item_name', 'updated_at']
    search_fields = ['item_name']


@admin.register(ProformaInvoice)
class ProformaInvoiceAdmin(admin.ModelAdmin):
    list_display = ['pi_number', 'buyer_po_number', 'customer', 'client_name', 'quantity', 'status', 'order_date', 'created_at']
    list_filter = ['status', 'order_date']
    search_fields = ['pi_number', 'client_name', 'client_email', 'buyer_po_number']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [ProformaInvoiceLineInline]
    date_hierarchy = 'order_date'


class BuyerPOLineInline(admin.TabularInline):
    model = BuyerPOLine
    extra = 0
    fields = ['line_number', 'item_code', 'item_name', 'fabric', 'color', 'customer_ref', 'quantity', 'unit_price', 'delivery_date', 'line_amount']


@admin.register(BuyerPO)
class BuyerPOAdmin(admin.ModelAdmin):
    list_display = ['po_number', 'po_date', 'buyer_name', 'customer', 'currency', 'total_qty', 'total_value', 'status', 'ex_factory_date']
    list_filter = ['status', 'currency', 'po_date']
    search_fields = ['po_number', 'buyer_name', 'buyer_contact', 'lines__item_code']
    readonly_fields = ['created_at', 'updated_at', 'total_qty', 'total_value']
    inlines = [BuyerPOLineInline]
    date_hierarchy = 'po_date'
