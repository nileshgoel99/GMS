from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import CompanyProfileView, CompanyCurrencyBankViewSet

router = DefaultRouter()
router.register('currency-banks', CompanyCurrencyBankViewSet, basename='currency-bank')

urlpatterns = [
    path('profile/', CompanyProfileView.as_view(), name='company-profile'),
    path('', include(router.urls)),
]
