from django.db import migrations, models


def backfill_pi_number(apps, schema_editor):
    PurchaseOrder = apps.get_model('procurement', 'PurchaseOrder')
    for po in PurchaseOrder.objects.filter(pi_number='').exclude(pi_id=None).select_related('pi'):
        if po.pi_id and getattr(po.pi, 'pi_number', None):
            po.pi_number = po.pi.pi_number
            po.save(update_fields=['pi_number'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('procurement', '0009_purchasebill_round_off'),
    ]

    operations = [
        migrations.AddField(
            model_name='purchaseorder',
            name='pi_number',
            field=models.CharField(
                blank=True,
                default='',
                help_text='PI reference number for display (free text; need not match a saved PI)',
                max_length=80,
            ),
        ),
        migrations.AlterField(
            model_name='purchaseorder',
            name='reference_number',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Buyer PO reference number for display (free text; need not match a saved Buyer PO)',
                max_length=120,
            ),
        ),
        migrations.RunPython(backfill_pi_number, noop_reverse),
    ]
