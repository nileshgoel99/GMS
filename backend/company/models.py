from django.db import models


class CompanyProfile(models.Model):
    """
    Singleton (pk=1) — legal entity shown on PDFs and in-app company details.
    """

    legal_name = models.CharField(max_length=255, help_text='Legal name on documents')
    trading_name = models.CharField(max_length=255, blank=True, default='')
    tagline = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text='Short line under legal name on PDF letterhead',
    )

    address_line1 = models.CharField(max_length=255, blank=True, default='')
    address_line2 = models.CharField(max_length=255, blank=True, default='')
    city = models.CharField(max_length=120, blank=True, default='')
    region_state = models.CharField(max_length=120, blank=True, default='')
    postal_code = models.CharField(max_length=32, blank=True, default='')
    country = models.CharField(max_length=120, blank=True, default='')

    phone = models.CharField(max_length=60, blank=True, default='')
    fax = models.CharField(max_length=60, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    website = models.URLField(blank=True, default='')

    tax_registration = models.CharField(
        max_length=120,
        blank=True,
        default='',
        help_text='GST / VAT / EIN / CIN — printed on PDF header',
    )

    logo = models.ImageField(upload_to='company/logo/', blank=True, null=True)

    pi_ref_prefix = models.CharField(
        max_length=20,
        blank=True,
        default='JBI',
        help_text='Short prefix for PI reference numbers, e.g. JBI → JBI/26-27/1',
    )

    our_bank_details = models.TextField(
        blank=True,
        default='',
        help_text='Primary company bank — printed on all PIs (e.g. Punjab National Bank details)',
    )

    watermark_text = models.CharField(
        max_length=64,
        blank=True,
        default='',
        help_text='Diagonal watermark on every PDF page; defaults to legal name if empty',
    )

    pdf_footer_note = models.TextField(
        blank=True,
        default='',
        help_text='Footer line on every PDF (e.g. registered office, jurisdiction)',
    )

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Company profile'
        verbose_name_plural = 'Company profile'

    def __str__(self):
        return self.legal_name or 'Company'

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(
            pk=1,
            defaults={'legal_name': 'Your organization name'},
        )
        return obj

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        return  # singleton


class CompanyCurrencyBank(models.Model):
    """
    Per-currency correspondent / intermediary bank.
    One row per currency code (USD, EUR, GBP, …).
    The primary OUR BANK stays on CompanyProfile; this model holds only the
    intermediary bank details that differ by currency.
    """
    currency = models.CharField(
        max_length=3,
        unique=True,
        db_index=True,
        help_text='3-letter ISO currency code, e.g. USD',
    )
    intermediary_bank_details = models.TextField(
        blank=True,
        default='',
        help_text='Correspondent / intermediary bank for this currency — printed on PI',
    )
    notes = models.CharField(max_length=255, blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['currency']
        verbose_name = 'Currency bank'
        verbose_name_plural = 'Currency banks'

    def __str__(self):
        return f"{self.currency} — {self.intermediary_bank_details[:60]}"
