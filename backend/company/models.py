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
