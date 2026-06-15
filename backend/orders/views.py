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
        'planning_sheet', 'intents', 'lines', 'buyer_pos',
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
        """Return distinct item codes with their most recent item_name and fabric.
        Optionally filtered by ?customer=<id> so codes stay buyer-specific."""
        from .models import BuyerPOLine
        from django.db.models import Max

        customer_id = request.query_params.get('customer')
        qs = BuyerPOLine.objects.exclude(item_code='')
        if customer_id:
            qs = qs.filter(po__customer_id=customer_id)

        latest_ids = (
            qs.values('item_code')
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

    @action(
        detail=True,
        methods=['post'],
        url_path='upload-document',
        parser_classes=[parsers.MultiPartParser, parsers.FormParser],
    )
    def upload_document(self, request, pk=None):
        """Upload or replace the original PO document file."""
        po = self.get_object()
        uploaded = request.FILES.get('file')
        if not uploaded:
            return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)
        if po.po_document:
            po.po_document.delete(save=False)
        po.po_document.save(uploaded.name, uploaded, save=True)
        doc_url = request.build_absolute_uri(po.po_document.url) if po.po_document else None
        return Response({'po_document': doc_url}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['delete'], url_path='remove-document')
    def remove_document(self, request, pk=None):
        """Delete the attached PO document."""
        po = self.get_object()
        if po.po_document:
            po.po_document.delete(save=True)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='create-pi')
    def create_pi(self, request, pk=None):
        """
        Build and save a ProformaInvoice from the confirmed PI data.
        Expects: { pi_ref, pi_date, port_of_discharge, payment_terms,
                   our_bank_details, intermediary_bank_details,
                   lines: [{item_name, material, color, size_breakdown,
                             quantity_pcs, unit_price_usd, line_value_usd}] }
        """
        from .models import ProformaInvoice
        from .serializers import ProformaInvoiceSerializer
        from datetime import date

        po = self.get_object()
        data = request.data

        pi_ref = data.get('pi_ref', '').strip()
        if not pi_ref:
            return Response({'detail': 'pi_ref is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # If a PI was already linked to this PO, delete it first so we regenerate cleanly
        if po.pi_id:
            try:
                old_pi = ProformaInvoice.objects.get(pk=po.pi_id)
                old_pi.delete()
            except ProformaInvoice.DoesNotExist:
                pass

        lines_data = data.get('lines', [])
        pi_date_str = data.get('pi_date') or date.today().isoformat()

        payload = {
            'pi_number':                   pi_ref,
            'customer':                    po.customer_id,
            'buyer_po_number':             po.po_number,
            'client_name':                 po.buyer_name or '',
            'client_address':              po.buyer_address or '',
            'order_date':                  pi_date_str,
            'delivery_date':               po.ex_factory_date.isoformat() if po.ex_factory_date else None,
            'status':                      'CONFIRMED',
            'payment_terms_display':       data.get('payment_terms', po.payment_terms or ''),
            'port_of_discharge':           data.get('port_of_discharge', ''),
            'port_of_loading':             data.get('port_of_loading', ''),
            'inco_terms':                  data.get('inco_terms', po.delivery_terms or ''),
            'our_bank_details':            data.get('our_bank_details', ''),
            'intermediary_bank_details':   data.get('intermediary_bank_details', ''),
            'date_of_dispatch_display':    data.get('date_of_dispatch_display', ''),
            'lines': [
                {
                    'item_code':      l.get('item_code', ''),
                    'item_name':      l.get('item_name', ''),
                    'material':       l.get('fabric', '') or l.get('material', ''),
                    'color':          l.get('color', ''),
                    'size_breakdown': l.get('sizes', l.get('size_breakdown', [])),
                    'quantity_pcs':   l.get('quantity', l.get('quantity_pcs', 0)),
                    'unit_price_usd': l.get('unit_price', l.get('unit_price_usd')),
                    'line_value_usd': l.get('line_amount', l.get('line_value_usd')),
                }
                for l in lines_data
            ],
        }

        serializer = ProformaInvoiceSerializer(data=payload, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        pi = serializer.save(created_by=request.user)

        # Link PI back to the BuyerPO
        po.pi = pi
        po.pi_ref = pi_ref
        po.save(update_fields=['pi', 'pi_ref'])

        return Response({'id': pi.id, 'pi_number': pi.pi_number}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='next-pi-ref')
    def next_pi_ref(self, request):
        """Return the next available PI ref number for the current fiscal year.
        Format: {prefix}/{YY-YY}/{seq}  e.g. JBI/26-27/12
        Indian fiscal year: April 1 → March 31.
        """
        from datetime import date
        from company.models import CompanyProfile

        today = date.today()
        # Determine fiscal year (April–March)
        if today.month >= 4:
            fy_start, fy_end = today.year, today.year + 1
        else:
            fy_start, fy_end = today.year - 1, today.year
        fy_label = f"{str(fy_start)[-2:]}-{str(fy_end)[-2:]}"

        company = CompanyProfile.get_solo()
        prefix = company.pi_ref_prefix or 'JBI'

        # Count PIs already issued this fiscal year
        pattern = f"{prefix}/{fy_label}/"
        existing = BuyerPO.objects.filter(pi_ref__startswith=pattern).count()
        seq = existing + 1

        return Response({'pi_ref': f"{prefix}/{fy_label}/{seq}", 'prefix': prefix, 'fy_label': fy_label, 'seq': seq})

    @action(detail=True, methods=['patch'], url_path='save-pi-ref')
    def save_pi_ref(self, request, pk=None):
        """Persist the confirmed PI ref number onto the BuyerPO record."""
        po = self.get_object()
        ref = request.data.get('pi_ref', '').strip()
        if not ref:
            return Response({'detail': 'pi_ref is required.'}, status=status.HTTP_400_BAD_REQUEST)
        po.pi_ref = ref
        po.save(update_fields=['pi_ref'])
        return Response({'pi_ref': po.pi_ref})
