from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProformaInvoiceViewSet, IntentViewSet

router = DefaultRouter()
router.register(r'pi', ProformaInvoiceViewSet, basename='proforma-invoice')
router.register(r'intents', IntentViewSet, basename='intent')

urlpatterns = [
    path('', include(router.urls)),
]
