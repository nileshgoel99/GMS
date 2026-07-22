from rest_framework import serializers

from .models import Ticket, TicketAttachment


class TicketAttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = TicketAttachment
        fields = ['id', 'url', 'uploaded_at']
        read_only_fields = fields

    def get_url(self, obj):
        request = self.context.get('request')
        if not obj.image:
            return None
        url = obj.image.url
        if request:
            return request.build_absolute_uri(url)
        return url


class TicketSerializer(serializers.ModelSerializer):
    attachments = TicketAttachmentSerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()
    ticket_type_display = serializers.CharField(source='get_ticket_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Ticket
        fields = [
            'id',
            'ticket_type',
            'ticket_type_display',
            'title',
            'description',
            'status',
            'status_display',
            'page_url',
            'admin_notes',
            'created_by',
            'created_by_name',
            'attachments',
            'created_at',
            'updated_at',
        ]
        read_only_fields = (
            'id',
            'created_by',
            'created_at',
            'updated_at',
            'attachments',
            'ticket_type_display',
            'status_display',
            'created_by_name',
        )

    def get_created_by_name(self, obj):
        user = obj.created_by
        if not user:
            return None
        full = f'{user.first_name} {user.last_name}'.strip()
        return full or user.username


class TicketCreateSerializer(serializers.ModelSerializer):
    """Create payload; attachments handled in the view from request.FILES."""

    class Meta:
        model = Ticket
        fields = ['ticket_type', 'title', 'description', 'page_url']

    def validate_ticket_type(self, value):
        allowed = {Ticket.TYPE_BUG, Ticket.TYPE_FEATURE}
        if value not in allowed:
            raise serializers.ValidationError('ticket_type must be BUG or FEATURE.')
        return value

    def validate_title(self, value):
        value = (value or '').strip()
        if len(value) < 3:
            raise serializers.ValidationError('Title must be at least 3 characters.')
        return value

    def validate_description(self, value):
        value = (value or '').strip()
        if len(value) < 5:
            raise serializers.ValidationError('Please describe the issue or request in more detail.')
        return value


class TicketAdminUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = ['status', 'admin_notes']

    def validate_status(self, value):
        allowed = {c[0] for c in Ticket.STATUS_CHOICES}
        if value not in allowed:
            raise serializers.ValidationError('Invalid status.')
        return value
