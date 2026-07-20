from decimal import Decimal, ROUND_HALF_UP

from django.db import migrations, models


def backfill_bill_round_off(apps, schema_editor):
    PurchaseBill = apps.get_model('procurement', 'PurchaseBill')
    for bill in PurchaseBill.objects.all().iterator():
        raw_total = (
            (bill.subtotal or Decimal('0'))
            + (bill.cgst_amount or Decimal('0'))
            + (bill.sgst_amount or Decimal('0'))
            + (bill.igst_amount or Decimal('0'))
        ).quantize(Decimal('0.01'))
        rounded_total = raw_total.quantize(Decimal('1'), rounding=ROUND_HALF_UP)
        bill.round_off = (rounded_total - raw_total).quantize(Decimal('0.01'))
        bill.total_amount = rounded_total
        bill.save(update_fields=['round_off', 'total_amount'])


class Migration(migrations.Migration):

    dependencies = [
        ('procurement', '0008_purchasebilldocument'),
    ]

    operations = [
        migrations.AddField(
            model_name='purchasebill',
            name='round_off',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text='Adjustment to round grand total to nearest rupee',
                max_digits=14,
            ),
        ),
        migrations.RunPython(backfill_bill_round_off, migrations.RunPython.noop),
    ]
