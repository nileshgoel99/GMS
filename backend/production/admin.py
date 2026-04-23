from django.contrib import admin
from .models import ProductionIssue, ProductionIssueItem, ProductionReturn, ProductionReturnItem


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
