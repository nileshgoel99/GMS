from datetime import date
from decimal import Decimal

from django.db.models import Count, Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404

from rest_framework import viewsets, filters, status, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import ProformaInvoice, TrimMaster, Indent, ItemIndentTemplate, BuyerPO, SalesEntry
from .pdf import build_pi_pdf_bytes
from .serializers import (
    ProformaInvoiceSerializer,
    ProformaInvoiceListSerializer,
    TrimMasterSerializer,
    IndentSerializer,
    IndentListSerializer,
    IndentPiOptionSerializer,
    IndentPiContextSerializer,
    ItemIndentTemplateSerializer,
    BuyerPOSerializer,
    BuyerPOListSerializer,
    SalesEntrySerializer,
    SalesEntryListSerializer,
    _sync_pi_totals,
)


class ProformaInvoiceViewSet(viewsets.ModelViewSet):
    queryset = ProformaInvoice.objects.all().select_related('created_by', 'customer').prefetch_related(
        'indents', 'lines', 'buyer_pos',
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

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if not instance.total_amount:
            _sync_pi_totals(instance)
            instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='pdf')
    def pdf(self, request, pk=None):
        pi = self.get_object()
        if not pi.total_amount:
            _sync_pi_totals(pi)
            pi.refresh_from_db()
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
        return Response({'total_orders': total, 'by_status': by_status})


class TrimMasterViewSet(viewsets.ModelViewSet):
    queryset = TrimMaster.objects.select_related('supplier').all()
    serializer_class = TrimMasterSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'category']
    ordering_fields = ['category', 'name', 'created_at']


class IndentViewSet(viewsets.ModelViewSet):
    queryset = Indent.objects.all().select_related('pi', 'created_by').prefetch_related(
        'fabric_lines', 'trim_lines', 'pi__lines', 'pi__buyer_pos',
    )
    serializer_class = IndentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['pi', 'status', 'indent_date']
    search_fields = ['indent_number', 'pi__pi_number']
    ordering_fields = ['indent_date', 'created_at', 'indent_number']

    def get_serializer_class(self):
        if self.action == 'list':
            return IndentListSerializer
        return IndentSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='next-number')
    def next_number(self, request):
        """Return next available indent number for the current fiscal year: IND/YY-YY/NNN."""
        from datetime import date
        today = date.today()
        if today.month >= 4:
            fy_start, fy_end = today.year, today.year + 1
        else:
            fy_start, fy_end = today.year - 1, today.year
        fy_label = f"{str(fy_start)[-2:]}-{str(fy_end)[-2:]}"
        pattern = f"IND/{fy_label}/"
        existing = Indent.objects.filter(indent_number__startswith=pattern).count()
        seq = existing + 1
        return Response({'indent_number': f"IND/{fy_label}/{seq:03d}", 'fy_label': fy_label, 'seq': seq})

    @action(detail=False, methods=['get'], url_path='template')
    def template(self, request):
        """Return saved indent template for a given item_name."""
        item_name = request.query_params.get('item_name', '').strip()
        if not item_name:
            return Response({'detail': 'item_name query param required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            tmpl = ItemIndentTemplate.objects.get(item_name=item_name)
            return Response(ItemIndentTemplateSerializer(tmpl).data)
        except ItemIndentTemplate.DoesNotExist:
            return Response(None, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'], url_path='pi-options')
    def pi_options(self, request):
        """PI list for indent creation — available without PI module access."""
        qs = ProformaInvoice.objects.all().order_by('-order_date', '-created_at')
        serializer = IndentPiOptionSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='pi-context')
    def pi_context(self, request):
        """Linked PI details for indent workflow — available without PI module access."""
        pi_id = request.query_params.get('pi', '').strip()
        if not pi_id:
            return Response({'detail': 'pi query param required.'}, status=status.HTTP_400_BAD_REQUEST)
        pi = get_object_or_404(ProformaInvoice.objects.prefetch_related('lines'), pk=pi_id)
        return Response(IndentPiContextSerializer(pi).data)

    @action(detail=False, methods=['get'], url_path='trims-library')
    def trims_library(self, request):
        """Read-only trims library for indent editor — available without trims module access."""
        qs = TrimMaster.objects.select_related('supplier').all().order_by('category', 'name')
        return Response(TrimMasterSerializer(qs, many=True).data)


class ItemIndentTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ItemIndentTemplate.objects.all().order_by('item_name')
    serializer_class = ItemIndentTemplateSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['item_name']


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

    @action(detail=False, methods=['get'], url_path='payment-due-summary')
    def payment_due_summary(self, request):
        """Sales entries receivable this month (goods dispatched / invoiced)."""
        from .models import SalesEntry
        from .sales_receivable import build_sales_receivables_payload
        payload = build_sales_receivables_payload(SalesEntry.objects.all())
        items = SalesEntryListSerializer(payload['payments_due_to_collect']['items'], many=True).data
        return Response({
            'current_month': payload['current_month'],
            'payments_due_to_collect': {
                **{k: v for k, v in payload['payments_due_to_collect'].items() if k != 'items'},
                'items': items,
            },
        })

    @action(
        detail=True,
        methods=['post'],
        url_path='upload-document',
        parser_classes=[parsers.MultiPartParser, parsers.FormParser],
    )
    def upload_document(self, request, pk=None):
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
        po = self.get_object()
        if po.po_document:
            po.po_document.delete(save=True)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='create-pi')
    def create_pi(self, request, pk=None):
        from datetime import date
        po = self.get_object()
        data = request.data
        pi_ref = data.get('pi_ref', '').strip()
        if not pi_ref:
            return Response({'detail': 'pi_ref is required.'}, status=status.HTTP_400_BAD_REQUEST)

        replace_existing = data.get('replace_existing') in (True, 'true', 1, '1')
        replaced_pi_id = None
        indents_removed = 0

        if po.pi_id:
            if not replace_existing:
                return Response({
                    'detail': (
                        'A PI already exists for this buyer PO. '
                        'Confirm replace to delete the old PI and create a new one.'
                    ),
                    'existing_pi_id': po.pi_id,
                    'existing_pi_ref': po.pi_ref,
                    'indent_count': po.pi.indents.count(),
                }, status=status.HTTP_409_CONFLICT)
            try:
                old_pi = ProformaInvoice.objects.get(pk=po.pi_id)
                replaced_pi_id = old_pi.id
                indents_removed = old_pi.indents.count()
                old_pi.delete()
            except ProformaInvoice.DoesNotExist:
                pass
        lines_data = data.get('lines', [])
        pi_date_str = data.get('pi_date') or date.today().isoformat()
        from company.models import CompanyProfile, CompanyCurrencyBank
        company = CompanyProfile.get_solo()
        inter_bank = (data.get('intermediary_bank_details') or '').strip()
        if not inter_bank and po.currency:
            currency_bank = CompanyCurrencyBank.objects.filter(
                currency=str(po.currency).upper(),
            ).first()
            if currency_bank:
                inter_bank = currency_bank.intermediary_bank_details or ''
        dispatch_display = (data.get('date_of_dispatch_display') or '').strip()
        if not dispatch_display and po.ex_factory_date:
            dispatch_display = (
                f"{po.ex_factory_date.strftime('%d %B %Y').upper()} (EX-FACTORY DATE)"
            )
        payload = {
            'pi_number':                   pi_ref,
            'customer':                    po.customer_id,
            'buyer_po_number':             po.po_number,
            'client_name':                 po.buyer_name or '',
            'client_address':              po.buyer_address or '',
            'order_date':                  pi_date_str,
            'delivery_date':               po.ex_factory_date.isoformat() if po.ex_factory_date else None,
            'status':                      'CONFIRMED',
            'payment_terms_display':       data.get('payment_terms') or po.payment_terms or '',
            'port_of_discharge':           data.get('port_of_discharge') or po.port_of_discharge or '',
            'port_of_loading':             data.get('port_of_loading') or po.port_of_loading or '',
            'inco_terms':                  data.get('inco_terms') or po.inco_terms or po.delivery_terms or '',
            'our_bank_details':            data.get('our_bank_details') or company.our_bank_details or '',
            'intermediary_bank_details':   inter_bank,
            'date_of_dispatch_display':    dispatch_display,
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
        po.pi = pi
        po.pi_ref = pi_ref
        po.save(update_fields=['pi', 'pi_ref'])
        return Response({
            'id': pi.id,
            'pi_number': pi.pi_number,
            'replaced_pi_id': replaced_pi_id,
            'indents_removed': indents_removed,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='next-pi-ref')
    def next_pi_ref(self, request):
        from datetime import date
        from company.models import CompanyProfile
        today = date.today()
        if today.month >= 4:
            fy_start, fy_end = today.year, today.year + 1
        else:
            fy_start, fy_end = today.year - 1, today.year
        fy_label = f"{str(fy_start)[-2:]}-{str(fy_end)[-2:]}"
        company = CompanyProfile.get_solo()
        prefix = company.pi_ref_prefix or 'JBI'
        pattern = f"{prefix}/{fy_label}/"
        existing = BuyerPO.objects.filter(pi_ref__startswith=pattern).count()
        seq = existing + 1
        return Response({'pi_ref': f"{prefix}/{fy_label}/{seq}", 'prefix': prefix, 'fy_label': fy_label, 'seq': seq})

    @action(detail=True, methods=['patch'], url_path='save-pi-ref')
    def save_pi_ref(self, request, pk=None):
        po = self.get_object()
        ref = request.data.get('pi_ref', '').strip()
        if not ref:
            return Response({'detail': 'pi_ref is required.'}, status=status.HTTP_400_BAD_REQUEST)
        po.pi_ref = ref
        po.save(update_fields=['pi_ref'])
        return Response({'pi_ref': po.pi_ref})


class SalesEntryViewSet(viewsets.ModelViewSet):
    queryset = SalesEntry.objects.all().select_related(
        'customer', 'buyer_po', 'pi', 'created_by',
    ).prefetch_related('items')
    serializer_class = SalesEntrySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'customer', 'buyer_po', 'sale_date', 'currency']
    search_fields = ['internal_ref', 'invoice_number', 'customer_name', 'buyer_po__po_number']
    ordering_fields = ['sale_date', 'due_date', 'created_at', 'internal_ref']

    def get_serializer_class(self):
        if self.action == 'list':
            return SalesEntryListSerializer
        return SalesEntrySerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='next-ref')
    def next_ref(self, request):
        from .sales_numbering import next_sales_entry_ref
        return Response(next_sales_entry_ref())

    @action(detail=False, methods=['get'], url_path='payment-due-summary')
    def payment_due_summary(self, request):
        from .sales_receivable import build_sales_receivables_payload
        payload = build_sales_receivables_payload(SalesEntry.objects.all())
        items = SalesEntryListSerializer(payload['payments_due_to_collect']['items'], many=True).data
        return Response({
            'current_month': payload['current_month'],
            'payments_due_to_collect': {
                **{k: v for k, v in payload['payments_due_to_collect'].items() if k != 'items'},
                'items': items,
            },
        })

    @action(detail=False, methods=['get'], url_path='prefill-from-buyer-po')
    def prefill_from_buyer_po(self, request):
        po_id = request.query_params.get('po_id')
        if not po_id:
            return Response({'detail': 'po_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            po = BuyerPO.objects.prefetch_related('lines').get(pk=po_id)
        except BuyerPO.DoesNotExist:
            return Response({'detail': 'Buyer PO not found.'}, status=status.HTTP_404_NOT_FOUND)

        items = []
        for idx, line in enumerate(po.lines.all(), start=1):
            items.append({
                'serial_no': idx,
                'buyer_po_line': line.id,
                'item_code': line.item_code,
                'item_name': line.item_name,
                'quantity': str(line.quantity or 0),
                'unit': line.uom or 'PCS',
                'unit_price': str(line.unit_price or 0),
            })

        return Response({
            'buyer_po': po.id,
            'po_number': po.po_number,
            'customer': po.customer_id,
            'customer_name': po.buyer_name or (po.customer.company_legal_name if po.customer_id else ''),
            'pi': po.pi_id,
            'pi_number': po.pi_ref or (po.pi.pi_number if po.pi_id else ''),
            'currency': po.currency or 'USD',
            'payment_terms': po.payment_terms or '',
            'sale_date': po.ex_factory_date.isoformat() if po.ex_factory_date else None,
            'items': items,
        })
