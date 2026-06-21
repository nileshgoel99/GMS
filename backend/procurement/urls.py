from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PurchaseOrderViewSet, POReceiptViewSet, PurchaseBillViewSet

router = DefaultRouter()
router.register(r'po', PurchaseOrderViewSet, basename='purchase-order')
router.register(r'receipts', POReceiptViewSet, basename='po-receipt')
router.register(r'bills', PurchaseBillViewSet, basename='purchase-bill')

urlpatterns = [
    path('', include(router.urls)),
]
