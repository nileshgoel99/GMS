from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from rest_framework import serializers

from .models import Customer, CustomerContact


def normalize_website(value):
    """Accept bare domains (edufire.co.uk) by prefixing https:// when needed."""
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    if '://' not in raw:
        raw = f'https://{raw}'
    return raw


class CustomerContactSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = CustomerContact
        fields = ['id', 'name', 'email', 'phone', 'designation', 'is_primary', 'sort_order']


class CustomerListSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    primary_contact_name = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            'id',
            'customer_code',
            'company_legal_name',
            'country',
            'region_state',
            'city',
            'postal_code',
            'address_line1',
            'address_line2',
            'primary_email',
            'primary_contact_name',
            'phone',
            'default_currency',
            'is_active',
            'created_by_name',
            'created_at',
        ]

    def get_primary_contact_name(self, obj):
        primary = obj.contacts.filter(is_primary=True).first()
        if primary:
            return primary.name
        return ''


class CustomerSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    display_name = serializers.CharField(read_only=True)
    contacts = CustomerContactSerializer(many=True, required=False)
    # CharField so bare domains are not rejected before we prepend https://
    website = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = Customer
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at', 'updated_at')

    def validate_customer_code(self, value):
        code = (value or '').strip()
        if not code:
            raise serializers.ValidationError('Customer code is required.')
        return code

    def validate_website(self, value):
        normalized = normalize_website(value)
        if not normalized:
            return None
        try:
            URLValidator()(normalized)
        except DjangoValidationError:
            raise serializers.ValidationError(
                'Enter a valid website (e.g. edufire.co.uk or https://edufire.co.uk).'
            )
        return normalized

    def validate(self, attrs):
        contacts = attrs.get('contacts')
        if contacts is not None:
            named = [c for c in contacts if (c.get('name') or '').strip()]
            if named:
                primaries = [c for c in named if c.get('is_primary')]
                if len(primaries) != 1:
                    raise serializers.ValidationError(
                        {'contacts': 'Mark exactly one contact as primary.'}
                    )
        return attrs

    def _sync_legacy_contact_fields(self, customer):
        primary = customer.contacts.filter(is_primary=True).first()
        secondary = customer.contacts.filter(is_primary=False).exclude(email='').first()
        if primary:
            customer.primary_email = primary.email or None
            customer.phone = primary.phone or None
            customer.mobile = primary.phone or None
        else:
            customer.primary_email = None
            customer.phone = None
            customer.mobile = None
        customer.secondary_email = secondary.email if secondary else None
        customer.save(
            update_fields=['primary_email', 'secondary_email', 'phone', 'mobile', 'updated_at']
        )

    def _save_contacts(self, customer, contacts_data):
        customer.contacts.all().delete()
        rows = []
        for i, row in enumerate(contacts_data or []):
            name = (row.get('name') or '').strip()
            if not name:
                continue
            rows.append(
                CustomerContact(
                    customer=customer,
                    name=name,
                    email=(row.get('email') or '').strip(),
                    phone=(row.get('phone') or '').strip(),
                    designation=(row.get('designation') or '').strip(),
                    is_primary=bool(row.get('is_primary')),
                    sort_order=row.get('sort_order', i),
                )
            )
        if rows and not any(r.is_primary for r in rows):
            rows[0].is_primary = True
        if rows:
            CustomerContact.objects.bulk_create(rows)
        self._sync_legacy_contact_fields(customer)

    def create(self, validated_data):
        contacts_data = validated_data.pop('contacts', [])
        customer = Customer.objects.create(**validated_data)
        self._save_contacts(customer, contacts_data)
        return customer

    def update(self, instance, validated_data):
        contacts_data = validated_data.pop('contacts', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if contacts_data is not None:
            self._save_contacts(instance, contacts_data)
        return instance
