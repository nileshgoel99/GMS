from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator


class InventoryItem(models.Model):
    CATEGORY_CHOICES = [
        ('BUTTON', 'Button'),
        ('THREAD', 'Thread'),
        ('ZIPPER', 'Zipper'),
        ('TAPE', 'Tape'),
        ('POLYBAG', 'Polybag'),
        ('FABRIC', 'Fabric'),
        ('LABEL', 'Label'),
        ('OTHER', 'Other'),
    ]
    
    UNIT_CHOICES = [
        ('PCS', 'Pieces'),
        ('MTR', 'Meters'),
        ('KG', 'Kilograms'),
        ('ROLL', 'Roll'),
        ('BOX', 'Box'),
        ('SET', 'Set'),
    ]
    
    item_code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=200)
    trim = models.ForeignKey(
        'orders.TrimMaster',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory_items',
    )
    spec_lines = models.JSONField(
        default=list,
        blank=True,
        help_text='Property lines extracted from PO/bill particulars',
    )
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    
    color = models.CharField(max_length=50, blank=True, null=True)
    size = models.CharField(max_length=50, blank=True, null=True)
    finish = models.CharField(max_length=100, blank=True, null=True)
    material = models.CharField(max_length=100, blank=True, null=True)
    
    unit = models.CharField(max_length=10, choices=UNIT_CHOICES, default='PCS')
    
    current_stock = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    reorder_level = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    
    description = models.TextField(blank=True, null=True)
    
    is_active = models.BooleanField(default=True)
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_items')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category', 'name']
        verbose_name = 'Inventory Item'
        verbose_name_plural = 'Inventory Items'

    def __str__(self):
        return f"{self.item_code} - {self.name}"
    
    @property
    def needs_reorder(self):
        return self.current_stock <= self.reorder_level


class InventoryLog(models.Model):
    TRANSACTION_TYPES = [
        ('ORDER', 'Ordered'),
        ('RECEIVE', 'Received'),
        ('ISSUE', 'Issued to Production'),
        ('ADJUST', 'Adjustment'),
        ('RETURN', 'Return'),
    ]
    
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='logs')
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    
    reference_type = models.CharField(max_length=20, blank=True, null=True)
    reference_id = models.CharField(max_length=50, blank=True, null=True)
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    
    vendor_supplier = models.CharField(max_length=200, blank=True, null=True)
    
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    
    stock_before = models.DecimalField(max_digits=12, decimal_places=2)
    stock_after = models.DecimalField(max_digits=12, decimal_places=2)

    # Business date of the movement (e.g. opening stock as-of date).
    # Falls back to created_at.date() in the API when null.
    transaction_date = models.DateField(null=True, blank=True, db_index=True)

    remarks = models.TextField(blank=True, null=True)
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Inventory Log'
        verbose_name_plural = 'Inventory Logs'

    def __str__(self):
        return f"{self.item.item_code} - {self.transaction_type} - {self.quantity}"


class InventoryItemAudit(models.Model):
    """Who changed or deleted an inventory item, and what changed."""

    ACTION_CHOICES = [
        ('UPDATE', 'Updated'),
        ('DELETE', 'Deleted'),
    ]

    item = models.ForeignKey(
        InventoryItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audits',
    )
    item_code = models.CharField(max_length=50, db_index=True)
    item_name = models.CharField(max_length=200, blank=True, default='')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    changes = models.JSONField(
        default=dict,
        blank=True,
        help_text='Field diffs: {field: {old, new}} or a snapshot on delete',
    )
    performed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='inventory_item_audits',
    )
    performed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-performed_at']
        verbose_name = 'Inventory item audit'
        verbose_name_plural = 'Inventory item audits'

    def __str__(self):
        who = self.performed_by.username if self.performed_by_id else 'unknown'
        return f"{self.item_code} {self.action} by {who} at {self.performed_at}"
