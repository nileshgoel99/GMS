from rest_framework import viewsets
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from .models import CompanyProfile, CompanyCurrencyBank, CompanyBankAccount
from .serializers import (
    CompanyProfileSerializer,
    CompanyCurrencyBankSerializer,
    CompanyBankAccountSerializer,
)


class CompanyProfileView(RetrieveUpdateAPIView):
    """GET/PATCH/PUT single organization profile (pk=1)."""

    serializer_class = CompanyProfileSerializer
    parser_classes = (JSONParser, MultiPartParser, FormParser)

    def get_object(self):
        return CompanyProfile.get_solo()


class CompanyCurrencyBankViewSet(viewsets.ModelViewSet):
    """CRUD for per-currency intermediary bank accounts."""
    queryset = CompanyCurrencyBank.objects.all()
    serializer_class = CompanyCurrencyBankSerializer


class CompanyBankAccountViewSet(viewsets.ModelViewSet):
    """CRUD for company OUR BANK accounts (selectable per PI)."""
    queryset = CompanyBankAccount.objects.all()
    serializer_class = CompanyBankAccountSerializer
