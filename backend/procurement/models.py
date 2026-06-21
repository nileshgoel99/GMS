from decimal import Decimal

from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from orders.models import ProformaInvoice, BuyerPO, TrimMaster
from inventory.models import InventoryItem


class PurchaseOrder(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('ORDERED', 'Ordered'),
        ('PARTIAL', 'Partially Received'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    TAX_MODE_CHOICES = [
        ('CGST_SGST', 'CGST + SGST'),
        ('IGST', 'IGST'),
    ]

    po_number = models.CharField(max_length=50, unique=True, db_index=True)
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_orders',
    )
    pi = models.ForeignKey(
        ProformaInvoice, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='purchase_orders',
    )
    buyer_po = models.ForeignKey(
        BuyerPO, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='supplier_purchase_orders',
        help_text='Buyer PO this supplier order references',
    )
    reference_number = models.CharField(
        max_length=120, blank=True, default='',
        help_text='Buyer PO reference number for display',
    )

    vendor_name = models.CharField(max_length=200)
    vendor_email = models.EmailField(blank=True, null=True)
    vendor_phone = models.CharField(max_length=40, blank=True, null=True)
    vendor_address = models.TextField(blank=True, null=True)
    attention = models.CharField(max_length=200, blank=True, default='')

    bill_to = models.TextField(blank=True, default='')
    ship_to = models.TextField(blank=True, default='')

    order_date = models.DateField()
    expected_delivery_date = models.DateField(blank=True, null=True)
    actual_delivery_date = models.DateField(blank=True, null=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tax_mode = models.CharField(max_length=12, choices=TAX_MODE_CHOICES, default='CGST_SGST')
    cgst_percent = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    sgst_percent = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    igst_percent = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    cgst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    sgst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    igst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, blank=True, null=True)

    payment_terms = models.CharField(max_length=500, blank=True, null=True)
    delivery_terms = models.CharField(max_length=200, blank=True, null=True)

    po_comments = models.TextField(blank=True, default='')
    order_placed_by = models.CharField(max_length=120, blank=True, default='Shivangi Jain')
    supplier_ack_name = models.CharField(max_length=120, blank=True, default='')
    supplier_ack_date = models.DateField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_pos')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Purchase Order'
        verbose_name_plural = 'Purchase Orders'

    def __str__(self):
        return f"{self.po_number} - {self.vendor_name}"

    def recalculate_totals(self, save=True):
        subtotal = Decimal('0')
        for line in self.items.all():
            qty = line.quantity_ordered or Decimal('0')
            price = line.unit_price or Decimal('0')
            line.total_price = (qty * price).quantize(Decimal('0.01'))
            line.save(update_fields=['total_price', 'updated_at'])
            subtotal += line.total_price

        self.subtotal = subtotal.quantize(Decimal('0.01'))
        cgst_pct = self.cgst_percent or Decimal('0')
        sgst_pct = self.sgst_percent or Decimal('0')
        igst_pct = self.igst_percent or Decimal('0')

        if self.tax_mode == 'IGST':
            self.cgst_amount = Decimal('0')
            self.sgst_amount = Decimal('0')
            self.igst_amount = (subtotal * igst_pct / Decimal('100')).quantize(Decimal('0.01'))
        else:
            self.cgst_amount = (subtotal * cgst_pct / Decimal('100')).quantize(Decimal('0.01'))
            self.sgst_amount = (subtotal * sgst_pct / Decimal('100')).quantize(Decimal('0.01'))
            self.igst_amount = Decimal('0')

        self.total_amount = (self.subtotal + self.cgst_amount + self.sgst_amount + self.igst_amount).quantize(Decimal('0.01'))
        if save:
            self.save(update_fields=[
                'subtotal', 'cgst_amount', 'sgst_amount', 'igst_amount', 'total_amount', 'updated_at',
            ])

    def update_status(self):
        items = self.items.filter(item__isnull=False)
        if not items.exists():
            return

        total_ordered = sum(item.quantity_ordered for item in items)
        total_received = sum(item.quantity_received for item in items)

        if total_received == 0:
            self.status = 'ORDERED'
        elif total_received < total_ordered:
            self.status = 'PARTIAL'
        else:
            self.status = 'COMPLETED'
        self.save(update_fields=['status', 'updated_at'])


class PurchaseOrderItem(models.Model):
    po = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='items')
    serial_no = models.PositiveIntegerField(default=1)
    trim = models.ForeignKey(
        TrimMaster, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='po_lines',
    )
    particulars = models.CharField(max_length=500, blank=True, default='')
    hsn_code = models.CharField(max_length=20, blank=True, default='')
    item = models.ForeignKey(
        InventoryItem, on_delete=models.CASCADE,
        null=True, blank=True, related_name='po_items',
    )
    quantity_ordered = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    quantity_received = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    unit = models.CharField(max_length=20, blank=True, default='PCS')
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    total_price = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Purchase Order Item'
        verbose_name_plural = 'Purchase Order Items'
        ordering = ['serial_no', 'id']

    def __str__(self):
        label = self.particulars or (self.trim.name if self.trim_id else (self.item.name if self.item_id else 'Line'))
        return f"{self.po.po_number} - {label}"

    @property
    def quantity_pending(self):
        return self.quantity_ordered - self.quantity_received


class POReceipt(models.Model):
    po = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='receipts')
    receipt_number = models.CharField(max_length=50, unique=True)
    receipt_date = models.DateField()
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-receipt_date']
        verbose_name = 'PO Receipt'
        verbose_name_plural = 'PO Receipts'

    def __str__(self):
        return f"Receipt {self.receipt_number} for {self.po.po_number}"


class POReceiptItem(models.Model):
    receipt = models.ForeignKey(POReceipt, on_delete=models.CASCADE, related_name='items')
    po_item = models.ForeignKey(PurchaseOrderItem, on_delete=models.CASCADE, related_name='receipt_items')
    quantity_received = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'PO Receipt Item'
        verbose_name_plural = 'PO Receipt Items'

    def __str__(self):
        return f"{self.receipt.receipt_number} - {self.po_item}"


class PurchaseBill(models.Model):
    """Supplier purchase bill — material received and payable."""

    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('OPEN', 'Open'),
        ('PARTIAL', 'Partially Paid'),
        ('PAID', 'Paid'),
        ('CANCELLED', 'Cancelled'),
    ]

    TAX_MODE_CHOICES = PurchaseOrder.TAX_MODE_CHOICES

    internal_ref = models.CharField(max_length=50, unique=True, db_index=True)
    bill_number = models.CharField(
        max_length=80,
        help_text="Supplier's invoice / bill number",
    )
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_bills',
    )
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bills',
    )
    supplier_name = models.CharField(max_length=200)
    bill_date = models.DateField()
    received_date = models.DateField(
        blank=True,
        null=True,
        help_text='Date material was received from supplier',
    )
    due_date = models.DateField(blank=True, null=True)
    payment_terms = models.CharField(max_length=500, blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tax_mode = models.CharField(max_length=12, choices=TAX_MODE_CHOICES, default='CGST_SGST')
    cgst_percent = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    sgst_percent = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    igst_percent = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    cgst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    sgst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    igst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_purchase_bills')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-bill_date', '-created_at']
        verbose_name = 'Purchase Bill'
        verbose_name_plural = 'Purchase Bills'

    def __str__(self):
        return f"{self.internal_ref} — {self.bill_number}"

    @property
    def balance_due(self):
        return (self.total_amount - self.amount_paid).quantize(Decimal('0.01'))

    def recalculate_totals(self, save=True):
        subtotal = Decimal('0')
        for line in self.items.all():
            qty = line.quantity_billed or Decimal('0')
            price = line.unit_price or Decimal('0')
            line.total_price = (qty * price).quantize(Decimal('0.01'))
            line.save(update_fields=['total_price'])
            subtotal += line.total_price

        self.subtotal = subtotal.quantize(Decimal('0.01'))
        cgst_pct = self.cgst_percent or Decimal('0')
        sgst_pct = self.sgst_percent or Decimal('0')
        igst_pct = self.igst_percent or Decimal('0')

        if self.tax_mode == 'IGST':
            self.cgst_amount = Decimal('0')
            self.sgst_amount = Decimal('0')
            self.igst_amount = (subtotal * igst_pct / Decimal('100')).quantize(Decimal('0.01'))
        else:
            self.cgst_amount = (subtotal * cgst_pct / Decimal('100')).quantize(Decimal('0.01'))
            self.sgst_amount = (subtotal * sgst_pct / Decimal('100')).quantize(Decimal('0.01'))
            self.igst_amount = Decimal('0')

        self.total_amount = (self.subtotal + self.cgst_amount + self.sgst_amount + self.igst_amount).quantize(Decimal('0.01'))
        if save:
            self.save(update_fields=[
                'subtotal', 'cgst_amount', 'sgst_amount', 'igst_amount', 'total_amount', 'updated_at',
            ])

    def sync_payment_status(self, save=True):
        paid = self.amount_paid or Decimal('0')
        total = self.total_amount or Decimal('0')
        if self.status == 'CANCELLED':
            return
        if paid <= 0:
            self.status = 'OPEN' if self.status != 'DRAFT' else 'DRAFT'
        elif paid >= total:
            self.status = 'PAID'
        else:
            self.status = 'PARTIAL'
        if save:
            self.save(update_fields=['status', 'updated_at'])


class PurchaseBillLine(models.Model):
    bill = models.ForeignKey(PurchaseBill, on_delete=models.CASCADE, related_name='items')
    po_item = models.ForeignKey(
        PurchaseOrderItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bill_lines',
    )
    serial_no = models.PositiveIntegerField(default=1)
    trim = models.ForeignKey(
        TrimMaster, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='bill_lines',
    )
    particulars = models.CharField(max_length=500, blank=True, default='')
    hsn_code = models.CharField(max_length=20, blank=True, default='')
    quantity_billed = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    unit = models.CharField(max_length=20, blank=True, default='PCS')
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        ordering = ['serial_no', 'id']
        verbose_name = 'Purchase Bill Line'
        verbose_name_plural = 'Purchase Bill Lines'

    def __str__(self):
        return f"{self.bill.internal_ref} — {self.particulars or 'Line'}"
