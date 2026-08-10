from django.contrib import admin
from .models import (
    ProductionIssue, ProductionIssueItem, ProductionReturn, ProductionReturnItem,
    CuttingRecord, FabricRoll,
)


class ProductionIssueItemInline(admin.TabularInline):
    model = ProductionIssueItem
    extra = 1


@admin.register(ProductionIssue)
class ProductionIssueAdmin(admin.ModelAdmin):
    list_display = ['issue_number', 'pi', 'production_team', 'issue_date', 'status', 'created_at']
    list_filter = ['status', 'issue_date']
    search_fields = ['issue_number', 'production_team', 'pi__pi_number']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [ProductionIssueItemInline]
    date_hierarchy = 'issue_date'


class ProductionReturnItemInline(admin.TabularInline):
    model = ProductionReturnItem
    extra = 1


@admin.register(ProductionReturn)
class ProductionReturnAdmin(admin.ModelAdmin):
    list_display = ['return_number', 'issue', 'return_date', 'created_at']
    list_filter = ['return_date']
    search_fields = ['return_number', 'issue__issue_number']
    readonly_fields = ['created_at']
    inlines = [ProductionReturnItemInline]
    date_hierarchy = 'return_date'


@admin.register(CuttingRecord)
class CuttingRecordAdmin(admin.ModelAdmin):
    list_display = [
        'cutting_number', 'cutting_date', 'buyer_po', 'pi',
        'item_name', 'color', 'total_pcs', 'ideal_consumption', 'total_consumption', 'status',
    ]
    list_filter = ['status', 'cutting_date']
    search_fields = [
        'cutting_number', 'item_code', 'item_name', 'fabric', 'color',
        'buyer_po__po_number', 'pi__pi_number',
    ]
    readonly_fields = ['created_at', 'updated_at', 'total_pcs', 'ideal_consumption', 'total_consumption']
    date_hierarchy = 'cutting_date'
    raw_id_fields = ['buyer_po', 'pi', 'pi_line', 'buyer_po_line']


@admin.register(FabricRoll)
class FabricRollAdmin(admin.ModelAdmin):
    list_display = ['roll_no', 'original_meters', 'current_balance', 'fabric', 'color', 'unit', 'updated_at']
    search_fields = ['roll_no', 'fabric', 'color']
    readonly_fields = ['created_at', 'updated_at']

