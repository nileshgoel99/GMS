from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator


class ProformaInvoice(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('CONFIRMED', 'Confirmed'),
        ('IN_PRODUCTION', 'In Production'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    pi_number = models.CharField(max_length=50, unique=True, db_index=True)
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='proforma_invoices',
        help_text='Customer master record — TO block on PI; client_* synced from here when set.',
    )
    buyer_po_number = models.CharField(max_length=120, blank=True, default='', help_text="Buyer's PO reference")
    client_name = models.CharField(max_length=200)
    client_email = models.EmailField(blank=True, null=True)
    client_phone = models.CharField(max_length=20, blank=True, null=True)
    client_address = models.TextField(blank=True, null=True)
    
    order_date = models.DateField()
    delivery_date = models.DateField(blank=True, null=True)
    
    garment_type = models.CharField(max_length=500, blank=True, default='', help_text='Summary of line items for lists/reports')
    quantity = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0)], help_text='Total pieces across PI lines')
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    notes = models.TextField(blank=True, null=True)

    # PI print / PDF — commercial terms (editable per PI)
    date_of_dispatch_display = models.CharField(
        max_length=400,
        blank=True,
        default='',
        help_text='e.g. 20TH FEBRUARY 2026 (EX-FACTORY DATE) — shown after DATE OF DISPATCH',
    )
    payment_terms_display = models.TextField(
        blank=True,
        default='',
        help_text='e.g. 20% ADVANCE, REMAINING 80% AGAINST SHIPMENT DOCUMENTS',
    )
    port_of_discharge = models.CharField(max_length=400, blank=True, default='')
    our_bank_details = models.TextField(blank=True, default='', help_text='OUR BANK block on PI')
    intermediary_bank_details = models.TextField(blank=True, default='', help_text='INTERMEDIARY BANK block on PI')
    seller_signatory_for = models.CharField(max_length=200, blank=True, default='CID TRADING LTD')
    buyer_signatory_for = models.CharField(max_length=200, blank=True, default='J B INTERNATIONAL')
    return_email_instruction = models.CharField(
        max_length=254,
        blank=True,
        default='shivangi.jain@jbinternational.co.in',
        help_text='E-mail for seal & sign return instruction',
    )

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_pis')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Proforma Invoice'
        verbose_name_plural = 'Proforma Invoices'

    def __str__(self):
        return f"{self.pi_number} - {self.client_name}"


class ProformaInvoiceLine(models.Model):
    """
    One sellable line on a PI (style + description + size split + qty + FOB + value).
    """
    pi = models.ForeignKey(ProformaInvoice, on_delete=models.CASCADE, related_name='lines')
    line_number = models.PositiveIntegerField(default=1)

    item_name = models.CharField(max_length=300, help_text='Garment / style name')
    description = models.TextField(
        blank=True,
        default='',
        help_text='Narrative description for PI (shown with size breakdown)',
    )
    material = models.TextField(blank=True, default='', help_text='e.g. fabric composition')
    color = models.CharField(max_length=120, blank=True, default='')
    size_breakdown = models.JSONField(
        default=list,
        blank=True,
        help_text='[{"size": "M", "qty": 450}, ...] — optional; qty pcs can be entered directly',
    )
    quantity_pcs = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0)])
    unit_price_usd = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    line_value_usd = models.DecimalField(max_digits=14, decimal_places=2, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['pi', 'line_number']
        unique_together = [('pi', 'line_number')]

    def __str__(self):
        return f"{self.pi.pi_number} L{self.line_number}: {self.item_name}"


class PlanningSheet(models.Model):
    pi = models.OneToOneField(ProformaInvoice, on_delete=models.CASCADE, related_name='planning_sheet')
    
    buttons_required = models.PositiveIntegerField(default=0)
    buttons_type = models.CharField(max_length=100, blank=True)
    buttons_color = models.CharField(max_length=50, blank=True)
    
    thread_required = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    thread_color = models.CharField(max_length=50, blank=True)
    thread_type = models.CharField(max_length=100, blank=True)
    
    zippers_required = models.PositiveIntegerField(default=0)
    zippers_size = models.CharField(max_length=50, blank=True)
    zippers_color = models.CharField(max_length=50, blank=True)
    
    tapes_required = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tapes_type = models.CharField(max_length=100, blank=True)
    tapes_color = models.CharField(max_length=50, blank=True)
    
    polybags_required = models.PositiveIntegerField(default=0)
    polybags_size = models.CharField(max_length=50, blank=True)
    
    fabric_required = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    fabric_type = models.CharField(max_length=100, blank=True)
    fabric_color = models.CharField(max_length=50, blank=True)
    
    labels_required = models.PositiveIntegerField(default=0)
    labels_type = models.CharField(max_length=100, blank=True)
    
    other_materials = models.JSONField(default=list, blank=True)
    
    notes = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Planning Sheet'
        verbose_name_plural = 'Planning Sheets'

    def __str__(self):
        return f"Planning Sheet for {self.pi.pi_number}"


class Intent(models.Model):
    """
    Indent / material requirement document raised against an internal PI.
    One intent can include several labelled **sheets** (like Excel tabs), each with its own
    size grid, description, and BOM. Header fields and sign-off live on the intent.
    Party order → internal PI → Intent → sheets (BOM) → POs to suppliers.
    """
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('SUBMITTED', 'Submitted'),
        ('APPROVED', 'Approved'),
        ('CLOSED', 'Closed'),
    ]

    pi = models.ForeignKey(
        ProformaInvoice,
        on_delete=models.CASCADE,
        related_name='intents',
    )
    indent_number = models.CharField(max_length=80, unique=True, db_index=True)
    buyer_po_reference = models.CharField(max_length=120, blank=True, null=True)
    intent_date = models.DateField()

    garment_sheet_name = models.CharField(
        max_length=200,
        blank=True,
        help_text='e.g. style / sheet tab name (Waterproof Trousers)',
    )
    item_description = models.TextField(blank=True)
    total_garment_qty = models.PositiveIntegerField(default=0)

    size_breakdown = models.JSONField(
        default=list,
        blank=True,
        help_text='List of rows: color, per-size qty, totals (see PI/indent templates)',
    )
    packing_notes = models.TextField(blank=True, null=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    prepared_by = models.CharField(max_length=120, blank=True, null=True)
    received_by = models.CharField(max_length=120, blank=True, null=True)
    approved_by = models.CharField(max_length=120, blank=True, null=True)

    notes = models.TextField(blank=True, null=True)

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_intents')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Intent (Indent)'
        verbose_name_plural = 'Intents (Indents)'

    def __str__(self):
        return f"{self.indent_number} → {self.pi.pi_number}"


class IntentSheet(models.Model):
    """
    One "Excel tab" under an intent: its own size/colour block, item description, and BOM lines.
    A single commercial indent (Intent) can contain several labelled sheets, matching your workbook.
    """
    intent = models.ForeignKey(Intent, on_delete=models.CASCADE, related_name='sheets')
    label = models.CharField(max_length=200, help_text='Excel tab / sheet name, e.g. Waterproof Trousers')
    sort_order = models.PositiveIntegerField(default=0, db_index=True)
    item_description = models.TextField(blank=True, default='')
    size_breakdown = models.JSONField(
        default=list,
        blank=True,
        help_text='List of colour rows, per-size qty, totals (same format as one PI sheet in Excel).',
    )
    total_garment_qty = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['intent', 'sort_order', 'id']
        verbose_name = 'Intent sheet (Excel tab)'

    def __str__(self):
        return f"{self.intent_id}: {self.label or '—'}"


class IntentLine(models.Model):
    """Single BOM / consumption line on a sheet (fabric, tape, thread, labels, etc.)."""

    intent = models.ForeignKey(Intent, on_delete=models.CASCADE, related_name='lines')
    sheet = models.ForeignKey(
        IntentSheet,
        on_delete=models.CASCADE,
        related_name='lines',
        help_text='BOM line belongs to one sheet (Excel tab).',
    )
    line_number = models.PositiveIntegerField(default=1)

    material_description = models.CharField(max_length=500)
    variant = models.CharField(max_length=200, blank=True, null=True)

    consumption_per_unit = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    unit = models.CharField(max_length=20, default='PCS', help_text='MTRS, PCS, CONE, etc.')
    total_required = models.DecimalField(max_digits=14, decimal_places=4, validators=[MinValueValidator(0)])

    inventory_item = models.ForeignKey(
        'inventory.InventoryItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='intent_lines',
        help_text='Optional link to store SKU when raising POs',
    )
    remarks = models.TextField(blank=True, null=True)
    extra = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sheet', 'line_number']
        unique_together = [('sheet', 'line_number')]

    def save(self, *args, **kwargs):
        if self.sheet_id:
            # Keep denormalized intent in sync (procurement, admin).
            self.intent_id = self.sheet.intent_id
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.intent.indent_number} {self.sheet.label} L{self.line_number}: {self.material_description}"


class IntentAttachment(models.Model):
    intent = models.ForeignKey(Intent, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='intent_attachments/%Y/%m/')
    description = models.CharField(max_length=255, blank=True, null=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.intent.indent_number} — {self.file.name}"
