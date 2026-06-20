from rest_framework import serializers

from .models import Supplier


class SupplierListSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Supplier
        fields = [
            'id', 'name', 'address', 'city', 'state_province', 'postal_code', 'country',
            'contact_person', 'email', 'phone', 'website',
            'is_international', 'tax_id_type', 'gst', 'currency',
            'is_active', 'created_by_name', 'created_at',
        ]


class SupplierSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Supplier
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at', 'updated_at')

    def validate_name(self, value):
        name = (value or '').strip()
        if not name:
            raise serializers.ValidationError('Supplier name is required.')
        return name

    def validate_country(self, value):
        country = (value or '').strip()
        if not country:
            raise serializers.ValidationError('Country is required.')
        return country
