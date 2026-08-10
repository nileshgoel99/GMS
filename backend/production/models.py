from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from orders.models import ProformaInvoice, ProformaInvoiceLine, BuyerPO, BuyerPOLine
from inventory.models import InventoryItem


class ProductionIssue(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('ISSUED', 'Issued'),
        ('IN_PRODUCTION', 'In Production'),
        ('COMPLETED', 'Completed'),
        ('RETURNED', 'Returned'),
    ]
    
    issue_number = models.CharField(max_length=50, unique=True, db_index=True)
    pi = models.ForeignKey(ProformaInvoice, on_delete=models.CASCADE, related_name='production_issues')
    
    issue_date = models.DateField()
    
    production_team = models.CharField(max_length=200, blank=True, null=True)
    production_manager = models.CharField(max_length=200, blank=True, null=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    notes = models.TextField(blank=True, null=True)
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_issues')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Production Issue'
        verbose_name_plural = 'Production Issues'

    def __str__(self):
        return f"{self.issue_number} - {self.pi.pi_number}"


class ProductionIssueItem(models.Model):
    issue = models.ForeignKey(ProductionIssue, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='production_issues')
    
    quantity_issued = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    quantity_returned = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    
    remarks = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Production Issue Item'
        verbose_name_plural = 'Production Issue Items'
        unique_together = ['issue', 'item']

    def __str__(self):
        return f"{self.issue.issue_number} - {self.item.name}"
    
    @property
    def quantity_consumed(self):
        return self.quantity_issued - self.quantity_returned


class ProductionReturn(models.Model):
    issue = models.ForeignKey(ProductionIssue, on_delete=models.CASCADE, related_name='returns')
    return_number = models.CharField(max_length=50, unique=True)
    
    return_date = models.DateField()
    
    notes = models.TextField(blank=True, null=True)
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-return_date']
        verbose_name = 'Production Return'
        verbose_name_plural = 'Production Returns'

    def __str__(self):
        return f"Return {self.return_number} for {self.issue.issue_number}"


class ProductionReturnItem(models.Model):
    return_record = models.ForeignKey(ProductionReturn, on_delete=models.CASCADE, related_name='items')
    issue_item = models.ForeignKey(ProductionIssueItem, on_delete=models.CASCADE, related_name='return_items')
    
    quantity_returned = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    
    remarks = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Production Return Item'
        verbose_name_plural = 'Production Return Items'

    def __str__(self):
        return f"{self.return_record.return_number} - {self.issue_item.item.name}"


class CuttingRecord(models.Model):
    """Record of fabric cutting against a Buyer PO / PI line. Does not deduct inventory."""

    STATUS_CHOICES = [
        ('RECORDED', 'Recorded'),
        ('CANCELLED', 'Cancelled'),
    ]

    cutting_number = models.CharField(max_length=50, unique=True, db_index=True)
    cutting_date = models.DateField()

    buyer_po = models.ForeignKey(
        BuyerPO, on_delete=models.PROTECT, related_name='cutting_records',
    )
    pi = models.ForeignKey(
        ProformaInvoice, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='cutting_records',
    )
    pi_line = models.ForeignKey(
        ProformaInvoiceLine, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='cutting_records',
    )
    buyer_po_line = models.ForeignKey(
        BuyerPOLine, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='cutting_records',
    )

    # Snapshots so history stays readable if source lines change
    item_code = models.CharField(max_length=100, blank=True, default='')
    item_name = models.CharField(max_length=300, blank=True, default='')
    fabric = models.CharField(max_length=500, blank=True, default='')
    color = models.CharField(max_length=120, blank=True, default='')
    roll_width = models.CharField(
        max_length=50, blank=True, default='',
        help_text='Fabric roll width from indent, e.g. 58 inch',
    )

    roll_numbers = models.JSONField(
        default=list, blank=True,
        help_text=(
            'Rolls used: [{"roll_no": "R-101", "total_meters": "120", '
            '"used_meters": "45.5", "rejected_meters": "1.5"}]'
        ),
    )
    size_breakdown = models.JSONField(
        default=list, blank=True,
        help_text='Cut quantities by size: [{"size": "M", "qty": 120}]',
    )

    consumption_per_pc = models.DecimalField(
        max_digits=10, decimal_places=4, default=0,
        help_text='Fabric consumption per pc from indent (or manual override)',
    )
    consumption_unit = models.CharField(max_length=20, default='MTRS')
    total_pcs = models.PositiveIntegerField(default=0)
    ideal_consumption = models.DecimalField(
        max_digits=14, decimal_places=4, default=0,
        help_text='Theoretical fabric use: consumption_per_pc × total_pcs',
    )
    total_consumption = models.DecimalField(
        max_digits=14, decimal_places=4, default=0,
        help_text='Actual fabric used: sum of roll used_meters',
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='RECORDED')
    notes = models.TextField(blank=True, default='')

    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='created_cuttings',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-cutting_date', '-created_at']
        verbose_name = 'Cutting Record'
        verbose_name_plural = 'Cutting Records'

    def __str__(self):
        return f"{self.cutting_number} — {self.buyer_po.po_number}"


class FabricRoll(models.Model):
    """Reusable fabric roll registry. Balance after a cut becomes total on next use."""

    roll_no = models.CharField(max_length=100, unique=True, db_index=True)
    original_meters = models.DecimalField(
        max_digits=14, decimal_places=4, default=0,
        help_text='Meters when the roll was first recorded',
    )
    current_balance = models.DecimalField(
        max_digits=14, decimal_places=4, default=0,
        help_text='Remaining meters after last cutting (used + rejected deducted)',
    )
    fabric = models.CharField(max_length=500, blank=True, default='')
    color = models.CharField(max_length=120, blank=True, default='')
    unit = models.CharField(max_length=20, default='MTRS')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['roll_no']
        verbose_name = 'Fabric Roll'
        verbose_name_plural = 'Fabric Rolls'

    def __str__(self):
        return f"{self.roll_no} ({self.current_balance} {self.unit})"
