from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProformaInvoiceViewSet, TrimMasterViewSet, IndentViewSet, ItemIndentTemplateViewSet, BuyerPOViewSet, SalesEntryViewSet

router = DefaultRouter()
router.register(r'pi', ProformaInvoiceViewSet, basename='proforma-invoice')
router.register(r'trims-master', TrimMasterViewSet, basename='trim-master')
router.register(r'indents', IndentViewSet, basename='indent')
router.register(r'indent-templates', ItemIndentTemplateViewSet, basename='indent-template')
router.register(r'buyer-pos', BuyerPOViewSet, basename='buyer-po')
router.register(r'sales', SalesEntryViewSet, basename='sales-entry')

urlpatterns = [
    path('', include(router.urls)),
]
