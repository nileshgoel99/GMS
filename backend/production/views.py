from datetime import date

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import ProductionIssue, ProductionIssueItem, ProductionReturn, CuttingRecord
from .serializers import (
    ProductionIssueSerializer,
    ProductionIssueListSerializer,
    ProductionIssueItemSerializer,
    ProductionReturnSerializer,
    CuttingRecordSerializer,
    CuttingRecordListSerializer,
)
from .cutting import (
    build_cutting_context,
    list_fabric_rolls,
    get_roll_usage_history,
    normalize_roll_entries,
    sync_rolls_for_cutting,
)
from inventory.models import InventoryLog


class ProductionIssueViewSet(viewsets.ModelViewSet):
    queryset = ProductionIssue.objects.all().select_related('pi', 'created_by').prefetch_related('items')
    serializer_class = ProductionIssueSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'pi', 'issue_date']
    search_fields = ['issue_number', 'production_team', 'production_manager']
    ordering_fields = ['issue_date', 'created_at', 'issue_number']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ProductionIssueListSerializer
        return ProductionIssueSerializer
    
    def perform_create(self, serializer):
        issue = serializer.save(created_by=self.request.user)
        
        if issue.status == 'ISSUED':
            for item in issue.items.all():
                InventoryLog.objects.create(
                    item=item.item,
                    transaction_type='ISSUE',
                    quantity=item.quantity_issued,
                    reference_type='PRODUCTION',
                    reference_id=str(issue.id),
                    reference_number=issue.issue_number,
                    stock_before=item.item.current_stock,
                    stock_after=item.item.current_stock - item.quantity_issued,
                    created_by=self.request.user
                )
                
                item.item.current_stock -= item.quantity_issued
                item.item.save()
    
    @action(detail=True, methods=['post'])
    def issue_materials(self, request, pk=None):
        issue = self.get_object()
        
        if issue.status != 'DRAFT':
            return Response(
                {'detail': 'Only draft issues can be issued'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        for item in issue.items.all():
            if item.item.current_stock < item.quantity_issued:
                return Response(
                    {'detail': f'Insufficient stock for {item.item.name}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        for item in issue.items.all():
            InventoryLog.objects.create(
                item=item.item,
                transaction_type='ISSUE',
                quantity=item.quantity_issued,
                reference_type='PRODUCTION',
                reference_id=str(issue.id),
                reference_number=issue.issue_number,
                stock_before=item.item.current_stock,
                stock_after=item.item.current_stock - item.quantity_issued,
                created_by=request.user
            )
            
            item.item.current_stock -= item.quantity_issued
            item.item.save()
        
        issue.status = 'ISSUED'
        issue.save()
        
        serializer = self.get_serializer(issue)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        total = self.queryset.count()
        by_status = {}
        for choice in ProductionIssue.STATUS_CHOICES:
            by_status[choice[0]] = self.queryset.filter(status=choice[0]).count()
        
        return Response({
            'total_issues': total,
            'by_status': by_status
        })


class ProductionReturnViewSet(viewsets.ModelViewSet):
    queryset = ProductionReturn.objects.all().select_related('issue', 'created_by').prefetch_related('items')
    serializer_class = ProductionReturnSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['issue', 'return_date']
    search_fields = ['return_number', 'issue__issue_number']
    ordering_fields = ['return_date', 'created_at']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class CuttingRecordViewSet(viewsets.ModelViewSet):
    queryset = (
        CuttingRecord.objects.all()
        .select_related('buyer_po', 'pi', 'pi_line', 'buyer_po_line', 'created_by')
    )
    serializer_class = CuttingRecordSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'buyer_po', 'pi', 'cutting_date']
    search_fields = [
        'cutting_number', 'item_code', 'item_name', 'fabric', 'color',
        'buyer_po__po_number', 'pi__pi_number',
    ]
    ordering_fields = ['cutting_date', 'created_at', 'cutting_number']

    def get_serializer_class(self):
        if self.action == 'list':
            return CuttingRecordListSerializer
        return CuttingRecordSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        previous_roll_nos = {
            e['roll_no'] for e in normalize_roll_entries(instance.roll_numbers or [])
        }
        # Keep a lightweight stub for sync after delete
        class _Stub:
            roll_numbers = []
            fabric = instance.fabric
            color = instance.color
            consumption_unit = instance.consumption_unit

        instance.delete()
        sync_rolls_for_cutting(_Stub(), previous_roll_nos=previous_roll_nos)

    @action(detail=False, methods=['get'], url_path='next-number')
    def next_number(self, request):
        today = date.today().strftime('%Y%m%d')
        prefix = f'CUT-{today}-'
        existing = (
            CuttingRecord.objects
            .filter(cutting_number__startswith=prefix)
            .order_by('-cutting_number')
            .values_list('cutting_number', flat=True)
            .first()
        )
        seq = 1
        if existing:
            try:
                seq = int(existing.rsplit('-', 1)[-1]) + 1
            except ValueError:
                seq = CuttingRecord.objects.filter(cutting_number__startswith=prefix).count() + 1
        return Response({'cutting_number': f'{prefix}{seq:03d}'})

    @action(detail=False, methods=['get'], url_path='context')
    def context(self, request):
        """Buyer PO → PI details + style lines with indent fabric consumption rates."""
        buyer_po_id = request.query_params.get('buyer_po', '').strip()
        if not buyer_po_id:
            return Response(
                {'detail': 'buyer_po query param required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        exclude = request.query_params.get('exclude_cutting', '').strip() or None
        return Response(build_cutting_context(buyer_po_id, exclude_cutting_id=exclude))


class FabricRollViewSet(viewsets.ViewSet):
    """Saved fabric rolls — search, pick existing, or inspect usage history."""

    def list(self, request):
        search = request.query_params.get('search', '')
        try:
            limit = min(int(request.query_params.get('limit', 100)), 500)
        except (TypeError, ValueError):
            limit = 100
        return Response(list_fabric_rolls(search=search, limit=limit))

    @action(detail=False, methods=['get'], url_path=r'by-number/(?P<roll_no>[^/]+)')
    def by_number(self, request, roll_no=None):
        from urllib.parse import unquote
        exclude = request.query_params.get('exclude_cutting', '').strip() or None
        history = get_roll_usage_history(unquote(roll_no or ''), exclude_cutting_id=exclude)
        if not history.get('exists'):
            return Response({'detail': 'Roll not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(history)

    @action(detail=False, methods=['get'], url_path=r'by-number/(?P<roll_no>[^/]+)/history')
    def history(self, request, roll_no=None):
        from urllib.parse import unquote
        exclude = request.query_params.get('exclude_cutting', '').strip() or None
        history = get_roll_usage_history(unquote(roll_no or ''), exclude_cutting_id=exclude)
        if not history.get('exists'):
            return Response({'detail': 'Roll not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(history)
