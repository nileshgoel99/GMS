from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProformaInvoiceViewSet, IntentViewSet, BuyerPOViewSet

router = DefaultRouter()
router.register(r'pi', ProformaInvoiceViewSet, basename='proforma-invoice')
router.register(r'intents', IntentViewSet, basename='intent')
router.register(r'buyer-pos', BuyerPOViewSet, basename='buyer-po')

urlpatterns = [
    path('', include(router.urls)),
]
