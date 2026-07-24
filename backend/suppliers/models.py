from django.contrib.auth.models import User
from django.db import models


class Supplier(models.Model):
    """Trim / material supplier master record."""

    name = models.CharField(max_length=255)
    address = models.TextField(blank=True, default='')
    city = models.CharField(max_length=120, blank=True, default='')
    state_province = models.CharField(max_length=120, blank=True, default='')
    postal_code = models.CharField(max_length=30, blank=True, default='')
    country = models.CharField(max_length=120, help_text='Country of supplier (any format)')

    contact_person = models.CharField(max_length=255, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    phone = models.CharField(max_length=40, blank=True, default='')
    website = models.CharField(max_length=255, blank=True, default='')

    is_international = models.BooleanField(
        default=False,
        help_text='International suppliers may use VAT/EIN or other tax identifiers',
    )
    tax_id_type = models.CharField(
        max_length=40,
        blank=True,
        default='',
        help_text='GST, VAT, EIN, Company Reg No, etc.',
    )
    gst = models.CharField(
        max_length=80,
        blank=True,
        default='',
        help_text='GST number (India) or tax / registration ID for overseas suppliers',
    )
    currency = models.CharField(
        max_length=10,
        blank=True,
        default='',
        help_text='Preferred invoicing currency for international suppliers (e.g. USD, EUR)',
    )

    notes = models.TextField(blank=True, default='')
    supplies_in = models.JSONField(
        default=list,
        blank=True,
        help_text='Trim names / categories this supplier provides (for segregation & filtering)',
    )
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_suppliers',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Supplier'
        verbose_name_plural = 'Suppliers'

    def __str__(self):
        return f"{self.name} ({self.country})"

    def add_supplies_in(self, *labels):
        """Append trim names/categories to supplies_in (case-insensitive, no dupes)."""
        items = list(self.supplies_in or [])
        changed = False
        for label in labels:
            text = (label or '').strip()
            if not text:
                continue
            if any(str(x).strip().lower() == text.lower() for x in items):
                continue
            items.append(text)
            changed = True
        if changed:
            self.supplies_in = items
            self.save(update_fields=['supplies_in', 'updated_at'])
        return changed
