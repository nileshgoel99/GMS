from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from orders.models import ProformaInvoice
from inventory.models import InventoryItem


class PurchaseOrder(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('ORDERED', 'Ordered'),
        ('PARTIAL', 'Partially Received'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    po_number = models.CharField(max_length=50, unique=True, db_index=True)
    pi = models.ForeignKey(ProformaInvoice, on_delete=models.SET_NULL,
                           null=True, blank=True, related_name='purchase_orders')
    intent = models.ForeignKey(
        'orders.Intent',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_orders',
        help_text='Indent this PO fulfills (optional; can still set PI separately)',
    )
    
    vendor_name = models.CharField(max_length=200)
    vendor_email = models.EmailField(blank=True, null=True)
    vendor_phone = models.CharField(max_length=20, blank=True, null=True)
    vendor_address = models.TextField(blank=True, null=True)
    
    order_date = models.DateField()
    expected_delivery_date = models.DateField(blank=True, null=True)
    actual_delivery_date = models.DateField(blank=True, null=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    
    payment_terms = models.CharField(max_length=200, blank=True, null=True)
    delivery_terms = models.CharField(max_length=200, blank=True, null=True)
    
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
    
    def save(self, *args, **kwargs):
        if self.intent_id and self.pi_id is None:
            self.pi = self.intent.pi
        super().save(*args, **kwargs)

    def update_status(self):
        items = self.items.all()
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
        self.save(update_fields=['status'])


class PurchaseOrderItem(models.Model):
    po = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='po_items')
    intent_line = models.ForeignKey(
        'orders.IntentLine',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='po_items',
        help_text='Links this PO line to an intent BOM line for split qty across suppliers',
    )

    quantity_ordered = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    quantity_received = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    total_price = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    
    notes = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Purchase Order Item'
        verbose_name_plural = 'Purchase Order Items'

    def __str__(self):
        return f"{self.po.po_number} - {self.item.name}"
    
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
        return f"{self.receipt.receipt_number} - {self.po_item.item.name}"
