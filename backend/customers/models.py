from django.contrib.auth.models import User
from django.db import models


class Customer(models.Model):
    """
    Customer / buyer master record.
    Canonical party for orders and proforma invoices (PI).
    """

    customer_code = models.CharField(max_length=40, unique=True, db_index=True)
    company_legal_name = models.CharField(max_length=255)
    trading_name = models.CharField(max_length=255, blank=True, null=True)

    country = models.CharField(max_length=120, help_text='Country or territory (any format)')
    region_state = models.CharField(max_length=120, blank=True, null=True)
    city = models.CharField(max_length=120, blank=True, null=True)
    postal_code = models.CharField(max_length=32, blank=True, null=True)

    address_line1 = models.TextField(blank=True, null=True)
    address_line2 = models.TextField(blank=True, null=True)

    primary_email = models.EmailField(blank=True, null=True)
    secondary_email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=40, blank=True, null=True)
    mobile = models.CharField(max_length=40, blank=True, null=True)
    fax = models.CharField(max_length=40, blank=True, null=True)
    website = models.URLField(blank=True, null=True)

    tax_id_vat = models.CharField(
        max_length=80,
        blank=True,
        null=True,
        help_text='VAT, GST, EIN, or other tax identifier',
    )

    default_currency = models.CharField(max_length=3, default='USD')
    preferred_language = models.CharField(max_length=16, default='en')

    incoterms_default = models.CharField(max_length=64, blank=True, null=True)
    payment_terms_default = models.TextField(blank=True, null=True)
    bank_details = models.TextField(blank=True, null=True)

    notes = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_customers',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['company_legal_name']
        verbose_name = 'Customer'
        verbose_name_plural = 'Customers'

    def __str__(self):
        return f"{self.customer_code} — {self.company_legal_name}"

    @property
    def display_name(self):
        return self.trading_name or self.company_legal_name
