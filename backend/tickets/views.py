from rest_framework import status, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAdminRole
from accounts.role_utils import user_is_admin

from .models import Ticket, TicketAttachment
from .serializers import (
    TicketAdminUpdateSerializer,
    TicketCreateSerializer,
    TicketSerializer,
)

MAX_ATTACHMENTS = 5
MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_IMAGE_CONTENT_TYPES = {
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
}


class TicketViewSet(viewsets.ModelViewSet):
    """
    POST  — any authenticated user (bug / feature + optional images)
    GET / PATCH / DELETE — admin only
    """

    queryset = Ticket.objects.select_related('created_by').prefetch_related('attachments').all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ['ticket_type', 'status']
    search_fields = ['title', 'description', 'page_url', 'created_by__username']
    ordering_fields = ['created_at', 'updated_at', 'status', 'ticket_type']

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

    def get_queryset(self):
        qs = super().get_queryset()
        ticket_type = self.request.query_params.get('ticket_type')
        status_param = self.request.query_params.get('status')
        if ticket_type:
            qs = qs.filter(ticket_type=ticket_type)
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return TicketCreateSerializer
        if self.action in ('update', 'partial_update'):
            return TicketAdminUpdateSerializer
        return TicketSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        files = request.FILES.getlist('images') or request.FILES.getlist('image')
        if len(files) > MAX_ATTACHMENTS:
            return Response(
                {'images': f'You can upload at most {MAX_ATTACHMENTS} images.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        for f in files:
            content_type = getattr(f, 'content_type', '') or ''
            if content_type and content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
                return Response(
                    {'images': f'Unsupported file type: {content_type}. Use JPEG, PNG, GIF, or WebP.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if f.size and f.size > MAX_ATTACHMENT_BYTES:
                return Response(
                    {'images': 'Each image must be 5 MB or smaller.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        ticket = serializer.save(created_by=request.user)
        for f in files:
            TicketAttachment.objects.create(ticket=ticket, image=f)

        out = TicketSerializer(ticket, context={'request': request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        out = TicketSerializer(instance, context={'request': request})
        return Response(out.data)

    def destroy(self, request, *args, **kwargs):
        if not user_is_admin(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)
