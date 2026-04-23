from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from orders.models import ProformaInvoice
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
