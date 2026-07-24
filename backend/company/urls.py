from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import CompanyProfileView, CompanyCurrencyBankViewSet, CompanyBankAccountViewSet

router = DefaultRouter()
router.register('currency-banks', CompanyCurrencyBankViewSet, basename='currency-bank')
router.register('bank-accounts', CompanyBankAccountViewSet, basename='bank-account')

urlpatterns = [
    path('profile/', CompanyProfileView.as_view(), name='company-profile'),
    path('', include(router.urls)),
]
