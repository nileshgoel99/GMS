from django.contrib import admin

from .models import CompanyProfile, CompanyBankAccount, CompanyCurrencyBank


@admin.register(CompanyProfile)
class CompanyProfileAdmin(admin.ModelAdmin):
    list_display = ('legal_name', 'email', 'phone', 'updated_at')
    readonly_fields = ('updated_at',)


@admin.register(CompanyBankAccount)
class CompanyBankAccountAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_default', 'sort_order', 'updated_at')
    list_filter = ('is_default',)
    search_fields = ('name', 'bank_details')


@admin.register(CompanyCurrencyBank)
class CompanyCurrencyBankAdmin(admin.ModelAdmin):
    list_display = ('currency', 'updated_at')
    search_fields = ('currency', 'intermediary_bank_details')
