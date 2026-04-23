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
    
    remarks = models.TextField(blank=True, null=True)
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Inventory Log'
        verbose_name_plural = 'Inventory Logs'

    def __str__(self):
        return f"{self.item.item_code} - {self.transaction_type} - {self.quantity}"
