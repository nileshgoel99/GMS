from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from .models import CompanyProfile
from .serializers import CompanyProfileSerializer


class CompanyProfileView(RetrieveUpdateAPIView):
    """GET/PATCH/PUT single organization profile (pk=1)."""

    serializer_class = CompanyProfileSerializer
    parser_classes = (JSONParser, MultiPartParser, FormParser)

    def get_object(self):
        return CompanyProfile.get_solo()
