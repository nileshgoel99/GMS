from rest_framework import serializers

from .models import CompanyProfile


class CompanyProfileSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = CompanyProfile
        fields = [
            'id',
            'legal_name',
            'trading_name',
            'tagline',
            'address_line1',
            'address_line2',
            'city',
            'region_state',
            'postal_code',
            'country',
            'phone',
            'fax',
            'email',
            'website',
            'tax_registration',
            'logo',
            'logo_url',
            'watermark_text',
            'pdf_footer_note',
            'updated_at',
        ]
        read_only_fields = ('id', 'logo_url', 'updated_at')

    def get_logo_url(self, obj):
        if not obj.logo:
            return None
        request = self.context.get('request')
        url = obj.logo.url
        if request:
            return request.build_absolute_uri(url)
        return url
