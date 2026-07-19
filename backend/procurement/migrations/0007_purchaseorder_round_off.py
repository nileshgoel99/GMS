from decimal import Decimal, ROUND_HALF_UP

from django.db import migrations, models


def backfill_round_off(apps, schema_editor):
    PurchaseOrder = apps.get_model('procurement', 'PurchaseOrder')
    for po in PurchaseOrder.objects.all().iterator():
        raw_total = (
            (po.subtotal or Decimal('0'))
            + (po.cgst_amount or Decimal('0'))
            + (po.sgst_amount or Decimal('0'))
            + (po.igst_amount or Decimal('0'))
        ).quantize(Decimal('0.01'))
        rounded_total = raw_total.quantize(Decimal('1'), rounding=ROUND_HALF_UP)
        po.round_off = (rounded_total - raw_total).quantize(Decimal('0.01'))
        po.total_amount = rounded_total
        po.save(update_fields=['round_off', 'total_amount'])


class Migration(migrations.Migration):

    dependencies = [
        ('procurement', '0006_po_transport_paid_by'),
    ]

    operations = [
        migrations.AddField(
            model_name='purchaseorder',
            name='round_off',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text='Adjustment to round grand total to nearest rupee',
                max_digits=14,
            ),
        ),
        migrations.RunPython(backfill_round_off, migrations.RunPython.noop),
    ]
