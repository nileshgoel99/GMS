from django.core.exceptions import ObjectDoesNotExist
from django.http import HttpResponse

from rest_framework import viewsets, filters, status, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import ProformaInvoice, PlanningSheet, Intent, BuyerPO
from .pdf import build_pi_pdf_bytes
from .serializers import (
    ProformaInvoiceSerializer,
    ProformaInvoiceListSerializer,
    PlanningSheetSerializer,
    IntentSerializer,
    IntentListSerializer,
    IntentAttachmentSerializer,
    BuyerPOSerializer,
    BuyerPOListSerializer,
)


class ProformaInvoiceViewSet(viewsets.ModelViewSet):
    queryset = ProformaInvoice.objects.all().select_related('created_by', 'customer').prefetch_related(
        'planning_sheet', 'intents', 'lines',
    )
    serializer_class = ProformaInvoiceSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'garment_type', 'order_date', 'customer']
    search_fields = ['pi_number', 'client_name', 'client_email', 'buyer_po_number']
    ordering_fields = ['order_date', 'created_at', 'pi_number']

    def get_serializer_class(self):
        if self.action == 'list':
            return ProformaInvoiceListSerializer
        return ProformaInvoiceSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['get', 'post', 'put'])
    def planning_sheet(self, request, pk=None):
        pi = self.get_object()

        def get_sheet():
            # Reverse OneToOne: missing row raises ObjectDoesNotExist — hasattr() is not safe here.
            try:
                return pi.planning_sheet
            except ObjectDoesNotExist:
                return None

        if request.method == 'GET':
            sheet = get_sheet()
            if sheet is not None:
                serializer = PlanningSheetSerializer(sheet)
                return Response(serializer.data)
            return Response({'detail': 'Planning sheet not found'}, status=status.HTTP_404_NOT_FOUND)

        if request.method in ['POST', 'PUT']:
            existing = get_sheet()
            if existing is not None:
                serializer = PlanningSheetSerializer(existing, data=request.data)
            else:
                serializer = PlanningSheetSerializer(data=request.data)

            if serializer.is_valid():
                serializer.save(pi=pi)
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='pdf')
    def pdf(self, request, pk=None):
        pi = self.get_object()
        data = build_pi_pdf_bytes(pi)
        filename = f'{pi.pi_number.replace("/", "-")}.pdf'
        resp = HttpResponse(data, content_type='application/pdf')
        resp['Content-Disposition'] = f'attachment; filename="{filename}"'
        return resp

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        total = self.queryset.count()
        by_status = {}
        for choice in ProformaInvoice.STATUS_CHOICES:
            by_status[choice[0]] = self.queryset.filter(status=choice[0]).count()

        return Response({
            'total_orders': total,
            'by_status': by_status,
        })


class IntentViewSet(viewsets.ModelViewSet):
    queryset = Intent.objects.all().select_related('pi', 'created_by').prefetch_related(
        'sheets', 'sheets__lines', 'lines', 'attachments',
    )
    serializer_class = IntentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['pi', 'status', 'intent_date']
    search_fields = [
        'indent_number', 'buyer_po_reference', 'item_description', 'garment_sheet_name',
        'sheets__label', 'sheets__item_description',
    ]
    ordering_fields = ['intent_date', 'created_at', 'indent_number']

    def get_serializer_class(self):
        if self.action == 'list':
            return IntentListSerializer
        return IntentSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(
        detail=True,
        methods=['post'],
        parser_classes=[parsers.MultiPartParser, parsers.FormParser],
    )
    def attachments(self, request, pk=None):
        intent = self.get_object()
        serializer = IntentAttachmentSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(intent=intent, uploaded_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BuyerPOViewSet(viewsets.ModelViewSet):
    queryset = BuyerPO.objects.all().select_related('customer', 'pi', 'created_by').prefetch_related('lines')
    serializer_class = BuyerPOSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'customer', 'currency']
    search_fields = ['po_number', 'buyer_name', 'buyer_contact', 'lines__item_code', 'lines__item_name']
    ordering_fields = ['po_date', 'created_at', 'po_number', 'total_value']

    def get_serializer_class(self):
        if self.action == 'list':
            return BuyerPOListSerializer
        return BuyerPOSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='item-catalogue')
    def item_catalogue(self, request):
        """Return distinct item codes with their most recent item_name and fabric."""
        from .models import BuyerPOLine
        from django.db.models import Max

        latest_ids = (
            BuyerPOLine.objects
            .exclude(item_code='')
            .values('item_code')
            .annotate(latest_id=Max('id'))
            .values_list('latest_id', flat=True)
        )
        items = (
            BuyerPOLine.objects
            .filter(id__in=latest_ids)
            .values('item_code', 'item_name', 'fabric')
            .order_by('item_code')
        )
        return Response(list(items))
