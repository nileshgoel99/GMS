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
    port_of_loading = models.CharField(max_length=400, blank=True, default='', help_text='e.g. NHAVA SHEVA PORT')
    inco_terms = models.CharField(max_length=200, blank=True, default='', help_text='e.g. FOB NHAVA SHEVA')
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

    item_code = models.CharField(max_length=100, blank=True, default='', help_text='Product code / style ref, e.g. V181-0-02A')
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


class TrimMaster(models.Model):
    """Master library of trim types used in indents."""
    name = models.CharField(max_length=300, unique=True, help_text='e.g. 5 CM WIDE Reflective Tape D6101')
    category = models.CharField(max_length=100, blank=True, default='', help_text='e.g. Tape, Button, Velcro, Label, Thread')
    default_unit = models.CharField(max_length=20, default='PCS', help_text='e.g. MTR, PCS, CONE')
    properties = models.JSONField(
        default=list,
        blank=True,
        help_text='Configurable properties: [{"name": "Width", "unit": "CM"}, {"name": "Color", "unit": ""}]',
    )
    default_property_values = models.JSONField(
        default=dict,
        blank=True,
        help_text='Default values for properties, e.g. {"PLY": "5 PLY", "Dimensions": "24.5*14.5*9"}',
    )
    notes = models.TextField(blank=True, default='')
    hsn_code = models.CharField(max_length=20, blank=True, default='', help_text='Default HSN/SAC for PO lines')
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='trims',
        help_text='Preferred supplier for this trim',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category', 'name']
        verbose_name = 'Trim Master'
        verbose_name_plural = 'Trims Library'

    def save(self, *args, **kwargs):
        if self.name:
            self.name = self.name.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Indent(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('CONFIRMED', 'Confirmed'),
    ]

    pi = models.ForeignKey(ProformaInvoice, on_delete=models.CASCADE, related_name='indents')
    selected_pi_line_ids = models.JSONField(
        default=list,
        blank=True,
        help_text='PI line IDs included in this indent',
    )
    indent_number = models.CharField(max_length=80, unique=True, db_index=True)
    indent_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')

    pcs_per_carton = models.PositiveIntegerField(default=0, blank=True)
    carton_ply = models.CharField(max_length=50, blank=True, default='', help_text='e.g. 5 PLY')
    carton_dimensions = models.CharField(max_length=100, blank=True, default='', help_text='e.g. 24.5*14.5*9 (L*W*H)')
    CARTON_DIM_UNIT_CHOICES = [
        ('CMS', 'Centimetres'),
        ('INCH', 'Inches'),
    ]
    carton_dimensions_unit = models.CharField(
        max_length=10,
        choices=CARTON_DIM_UNIT_CHOICES,
        default='CMS',
        blank=True,
    )
    carton_boxes = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            'Multiple carton size rows, e.g. '
            '[{"trim_id": 1, "pcs_per_carton": 12, "carton_ply": "5 PLY", '
            '"carton_dimensions": "24.5*14.5*9", "carton_dimensions_unit": "CMS"}]'
        ),
    )

    prepared_by = models.CharField(max_length=120, blank=True, default='')
    received_by = models.CharField(max_length=120, blank=True, default='')
    approved_by = models.CharField(max_length=120, blank=True, default='')
    notes = models.TextField(blank=True, default='')

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_indents')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Indent'
        verbose_name_plural = 'Indents'

    def __str__(self):
        return f"{self.indent_number} → {self.pi.pi_number}"


class IndentFabricLine(models.Model):
    """One fabric consumption row on an indent (one row per fabric × colour)."""
    indent = models.ForeignKey(Indent, on_delete=models.CASCADE, related_name='fabric_lines')
    material = models.CharField(max_length=500)
    color = models.CharField(max_length=120, blank=True, default='')
    gsm = models.CharField(max_length=50, blank=True, default='', help_text='Fabric weight e.g. 245 GSM')
    roll_width = models.CharField(max_length=50, blank=True, default='', help_text='Optional width of the fabric roll, e.g. 58 inch')
    consumption_per_pc = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    unit = models.CharField(max_length=20, default='MTRS')
    total_consumption = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    remarks = models.CharField(max_length=200, blank=True, default='')
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['indent', 'sort_order', 'id']

    def __str__(self):
        return f"{self.indent.indent_number} fabric: {self.material} / {self.color}"


class IndentTrimLine(models.Model):
    """One trim / accessory consumption row on an indent."""
    indent = models.ForeignKey(Indent, on_delete=models.CASCADE, related_name='trim_lines')
    trim = models.ForeignKey(TrimMaster, on_delete=models.SET_NULL, null=True, blank=True, related_name='indent_lines')
    trim_name = models.CharField(max_length=300)
    category = models.CharField(max_length=100, blank=True, default='')
    color_variant = models.CharField(max_length=120, blank=True, default='', help_text='e.g. Orange, GREY, Hi Vis Yellow')
    size_variant = models.CharField(max_length=100, blank=True, default='', help_text='e.g. 6.5 inch, 7 inch')
    property_values = models.JSONField(
        default=dict,
        blank=True,
        help_text='Values for trim properties, e.g. {"Width": "5", "Color": "Orange"}',
    )
    consumption_per_pc = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    unit = models.CharField(max_length=20, default='PCS')
    total_consumption = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    total_unit = models.CharField(max_length=20, blank=True, default='')
    parts = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            'Optional multi-part consumption breakdown for trims made of several '
            'components sharing one colour/qty basis, e.g. Velcro Hook & Loop: '
            '[{"label": "Hook", "consumption_per_pc": "0.28", "unit": "MTRS", '
            '"total_consumption": "1124.2", "total_unit": "MTRS"}, {"label": "Loop", ...}]'
        ),
    )
    remarks = models.CharField(max_length=200, blank=True, default='', help_text='e.g. in stock')
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['indent', 'sort_order', 'id']

    def save(self, *args, **kwargs):
        if self.trim_name:
            self.trim_name = self.trim_name.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.indent.indent_number} trim: {self.trim_name} / {self.color_variant}"


class ItemIndentTemplate(models.Model):
    """Stores fabric + trim defaults for an item_name so future indents auto-fill."""
    item_name = models.CharField(max_length=300, unique=True, db_index=True)
    fabric_lines = models.JSONField(default=list, blank=True)
    trim_lines = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Item Indent Template'
        verbose_name_plural = 'Item Indent Templates'

    def __str__(self):
        return f"Template: {self.item_name}"


class BuyerPO(models.Model):
    """
    Purchase Order received FROM a buyer (e.g. COFRA PO 1112673).
    Captures all header metadata and links to line items.
    """
    STATUS_CHOICES = [
        ('RECEIVED', 'Received'),
        ('ACKNOWLEDGED', 'Acknowledged'),
        ('IN_PRODUCTION', 'In Production'),
        ('SHIPPED', 'Shipped'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    po_number = models.CharField(max_length=100, unique=True, db_index=True)
    po_date = models.DateField()

    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='buyer_pos',
    )
    buyer_name = models.CharField(max_length=200, blank=True, default='')
    buyer_address = models.TextField(blank=True, default='')
    buyer_contact = models.CharField(max_length=200, blank=True, default='', help_text='e.g. Mr. Himanshu Banka')
    supplier_code = models.CharField(max_length=50, blank=True, default='', help_text="Buyer's supplier code for us")

    currency = models.CharField(max_length=3, default='USD')

    delivery_terms = models.CharField(max_length=200, blank=True, default='', help_text='e.g. FOB-FREE ON BOARD')
    payment_terms = models.TextField(blank=True, default='', help_text='e.g. 60 DAYS FROM B/L DATE, D/A')
    delivery_method = models.CharField(max_length=200, blank=True, default='', help_text='e.g. THROUGH CARRIER - BY SEA')
    freight_terms = models.CharField(max_length=200, blank=True, default='')
    packaging_terms = models.CharField(max_length=200, blank=True, default='')
    inco_terms = models.CharField(max_length=200, blank=True, default='', help_text='e.g. FOB NHAVA SHEVA')
    port_of_loading = models.CharField(max_length=400, blank=True, default='', help_text='e.g. NHAVA SHEVA PORT')
    port_of_discharge = models.CharField(max_length=400, blank=True, default='', help_text='e.g. KHIDIRPUR PORT')

    ex_factory_date = models.DateField(null=True, blank=True)

    total_qty = models.PositiveIntegerField(default=0)
    total_value = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='RECEIVED')
    notes = models.TextField(blank=True, default='')
    po_document = models.FileField(upload_to='buyer_po_docs/', null=True, blank=True, help_text='Scanned/original PO file from buyer')

    pi_ref = models.CharField(
        max_length=80,
        blank=True,
        default='',
        unique=False,
        help_text='PI reference number generated from this PO, e.g. JBI/26-27/11',
    )

    pi = models.ForeignKey(
        ProformaInvoice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='buyer_pos',
        help_text='Our internal PI linked to this buyer PO',
    )

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_buyer_pos')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-po_date', '-created_at']
        verbose_name = 'Buyer PO'
        verbose_name_plural = 'Buyer POs'

    def __str__(self):
        return f"PO {self.po_number} — {self.buyer_name or 'Unknown buyer'}"


class BuyerPOLine(models.Model):
    """One garment style / colour on a buyer PO."""

    po = models.ForeignKey(BuyerPO, on_delete=models.CASCADE, related_name='lines')
    line_number = models.PositiveIntegerField(default=1)

    item_code = models.CharField(max_length=100, blank=True, default='', help_text='e.g. V181-0-02A')
    item_name = models.CharField(max_length=300, help_text='e.g. TROUSERS "RABAT"')
    fabric = models.CharField(max_length=500, blank=True, default='', help_text='e.g. 65% polyester/35% cotton 245gr./sqm')
    color = models.CharField(max_length=120, blank=True, default='')

    customer_ref = models.CharField(max_length=200, blank=True, default='', help_text='OdL No / buyer line ref')
    agreement_no = models.CharField(max_length=200, blank=True, default='')

    size_breakdown = models.JSONField(
        default=list,
        blank=True,
        help_text='[{"size": "S", "qty": 350}, ...] — flexible sizes per party',
    )
    quantity = models.PositiveIntegerField(default=0, help_text='Total pieces (auto-sum from sizes or manual)')
    uom = models.CharField(max_length=20, default='PCS', blank=True, help_text='Unit of measure, e.g. PCS, DZ')
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    discount = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text='Discount % (0–100)')
    delivery_date = models.DateField(null=True, blank=True)
    line_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['po', 'line_number']
        unique_together = [('po', 'line_number')]

    def __str__(self):
        return f"PO {self.po.po_number} L{self.line_number}: {self.item_name}"


class SalesEntry(models.Model):
    """Sales / dispatch entry — goods shipped to buyer; drives receivables."""

    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('OPEN', 'Open'),
        ('PARTIAL', 'Partially Received'),
        ('PAID', 'Paid'),
        ('CANCELLED', 'Cancelled'),
    ]

    internal_ref = models.CharField(max_length=50, unique=True, db_index=True)
    invoice_number = models.CharField(
        max_length=80,
        help_text='Sales / commercial invoice number',
    )
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales_entries',
    )
    buyer_po = models.ForeignKey(
        BuyerPO,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales_entries',
    )
    pi = models.ForeignKey(
        ProformaInvoice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales_entries',
    )
    customer_name = models.CharField(max_length=200)
    currency = models.CharField(max_length=3, default='USD')
    sale_date = models.DateField(help_text='Dispatch / ex-factory / invoice date')
    due_date = models.DateField(blank=True, null=True)
    payment_terms = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    amount_received = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_sales_entries')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-sale_date', '-created_at']
        verbose_name = 'Sales Entry'
        verbose_name_plural = 'Sales Entries'

    def __str__(self):
        return f"{self.internal_ref} — {self.invoice_number}"

    @property
    def balance_due(self):
        return (self.total_amount - self.amount_received).quantize(Decimal('0.01'))

    def recalculate_totals(self, save=True):
        subtotal = Decimal('0')
        for line in self.items.all():
            qty = line.quantity or Decimal('0')
            price = line.unit_price or Decimal('0')
            line.total_price = (qty * price).quantize(Decimal('0.01'))
            line.save(update_fields=['total_price'])
            subtotal += line.total_price
        self.subtotal = subtotal.quantize(Decimal('0.01'))
        self.total_amount = self.subtotal
        if save:
            self.save(update_fields=['subtotal', 'total_amount', 'updated_at'])

    def sync_collection_status(self, save=True):
        received = self.amount_received or Decimal('0')
        total = self.total_amount or Decimal('0')
        if self.status == 'CANCELLED':
            return
        if received <= 0:
            self.status = 'OPEN' if self.status != 'DRAFT' else 'DRAFT'
        elif received >= total:
            self.status = 'PAID'
        else:
            self.status = 'PARTIAL'
        if save:
            self.save(update_fields=['status', 'updated_at'])


class SalesEntryLine(models.Model):
    sales_entry = models.ForeignKey(SalesEntry, on_delete=models.CASCADE, related_name='items')
    buyer_po_line = models.ForeignKey(
        BuyerPOLine,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales_lines',
    )
    serial_no = models.PositiveIntegerField(default=1)
    item_code = models.CharField(max_length=100, blank=True, default='')
    item_name = models.CharField(max_length=300, blank=True, default='')
    quantity = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    unit = models.CharField(max_length=20, blank=True, default='PCS')
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ['serial_no', 'id']
        verbose_name = 'Sales Entry Line'
        verbose_name_plural = 'Sales Entry Lines'

    def __str__(self):
        return f"{self.sales_entry.internal_ref} — {self.item_name or 'Line'}"

