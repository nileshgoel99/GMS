from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PurchaseOrderViewSet, POReceiptViewSet

router = DefaultRouter()
router.register(r'po', PurchaseOrderViewSet, basename='purchase-order')
router.register(r'receipts', POReceiptViewSet, basename='po-receipt')

urlpatterns = [
    path('', include(router.urls)),
]
