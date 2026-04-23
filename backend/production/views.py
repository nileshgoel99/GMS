from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import ProductionIssue, ProductionIssueItem, ProductionReturn
from .serializers import (
    ProductionIssueSerializer,
    ProductionIssueListSerializer,
    ProductionIssueItemSerializer,
    ProductionReturnSerializer
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
