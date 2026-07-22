from django.contrib import admin

from .models import Ticket, TicketAttachment


class TicketAttachmentInline(admin.TabularInline):
    model = TicketAttachment
    extra = 0
    readonly_fields = ['uploaded_at']


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ['id', 'ticket_type', 'title', 'status', 'created_by', 'created_at']
    list_filter = ['ticket_type', 'status', 'created_at']
    search_fields = ['title', 'description', 'page_url', 'created_by__username']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [TicketAttachmentInline]
