from rest_framework import serializers

from .models import Customer


class CustomerListSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Customer
        fields = [
            'id',
            'customer_code',
            'company_legal_name',
            'trading_name',
            'country',
            'city',
            'primary_email',
            'phone',
            'default_currency',
            'is_active',
            'created_by_name',
            'created_at',
        ]


class CustomerSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = Customer
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at', 'updated_at')
