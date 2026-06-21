from decimal import Decimal

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0016_trimmaster_supplier'),
        ('suppliers', '0002_supplier_contact_and_tax_fields'),
        ('procurement', '0003_remove_purchaseorder_intent_and_more'),
        ('inventory', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='purchaseorder',
            name='attention',
            field=models.CharField(blank=True, default='', max_length=200),
        ),
        migrations.AddField(
            model_name='purchaseorder',
            name='bill_to',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='purchaseorder',
            name='buyer_po',
            field=models.ForeignKey(
                blank=True,
                help_text='Buyer PO this supplier order references',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='supplier_purchase_orders',
                to='orders.buyerpo',
            ),
        ),
        migrations.AddField(
            model_name='purchaseorder',
            name='cgst_amount',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.AddField(
            model_name='purchaseorder',
            name='cgst_percent',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=6),
        ),
        migrations.AddField(
            model_name='purchaseorder',
            name='igst_amount',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.AddField(
            model_name='purchaseorder',
            name='igst_percent',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=6),
        ),
        migrations.AddField(
            model_name='purchaseorder',
            name='order_placed_by',
            field=models.CharField(blank=True, default='Shivangi Jain', max_length=120),
        ),
        migrations.AddField(
            model_name='purchaseorder',
            name='po_comments',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='purchaseorder',
            name='reference_number',
            field=models.CharField(blank=True, default='', help_text='Display reference — PI / Buyer PO numbers', max_length=120),
        ),
        migrations.AddField(
            model_name='purchaseorder',
            name='sgst_amount',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.AddField(
            model_name='purchaseorder',
            name='sgst_percent',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=6),
        ),
        migrations.AddField(
            model_name='purchaseorder',
            name='ship_to',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='purchaseorder',
            name='subtotal',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.AddField(
            model_name='purchaseorder',
            name='supplier',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='purchase_orders',
                to='suppliers.supplier',
            ),
        ),
        migrations.AddField(
            model_name='purchaseorder',
            name='supplier_ack_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='purchaseorder',
            name='supplier_ack_name',
            field=models.CharField(blank=True, default='', max_length=120),
        ),
        migrations.AddField(
            model_name='purchaseorder',
            name='tax_mode',
            field=models.CharField(
                choices=[('CGST_SGST', 'CGST + SGST'), ('IGST', 'IGST')],
                default='CGST_SGST',
                max_length=12,
            ),
        ),
        migrations.AlterField(
            model_name='purchaseorder',
            name='payment_terms',
            field=models.CharField(blank=True, max_length=500, null=True),
        ),
        migrations.AlterField(
            model_name='purchaseorder',
            name='total_amount',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True),
        ),
        migrations.AlterField(
            model_name='purchaseorder',
            name='vendor_phone',
            field=models.CharField(blank=True, max_length=40, null=True),
        ),
        migrations.AddField(
            model_name='purchaseorderitem',
            name='hsn_code',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='purchaseorderitem',
            name='particulars',
            field=models.CharField(blank=True, default='', max_length=500),
        ),
        migrations.AddField(
            model_name='purchaseorderitem',
            name='serial_no',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='purchaseorderitem',
            name='trim',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='po_lines',
                to='orders.trimmaster',
            ),
        ),
        migrations.AddField(
            model_name='purchaseorderitem',
            name='unit',
            field=models.CharField(blank=True, default='PCS', max_length=20),
        ),
        migrations.AlterField(
            model_name='purchaseorderitem',
            name='item',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='po_items',
                to='inventory.inventoryitem',
            ),
        ),
    ]
