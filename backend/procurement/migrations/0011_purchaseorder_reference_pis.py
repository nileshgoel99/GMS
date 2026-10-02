from django.db import migrations, models


def copy_single_references(apps, schema_editor):
    PurchaseOrder = apps.get_model('procurement', 'PurchaseOrder')
    for po in PurchaseOrder.objects.all().iterator():
        if po.pi_id:
            po.reference_pis.add(po.pi_id)
        if po.buyer_po_id:
            po.reference_buyer_pos.add(po.buyer_po_id)


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0031_overall_discount_amount'),
        ('procurement', '0010_purchaseorder_pi_number'),
    ]

    operations = [
        migrations.AddField(
            model_name='purchaseorder',
            name='reference_buyer_pos',
            field=models.ManyToManyField(
                blank=True,
                help_text='Buyer POs auto-linked from the selected reference PIs',
                related_name='referenced_supplier_pos',
                to='orders.buyerpo',
            ),
        ),
        migrations.AddField(
            model_name='purchaseorder',
            name='reference_pis',
            field=models.ManyToManyField(
                blank=True,
                help_text='All proforma invoices this supplier PO is raised against',
                related_name='referenced_supplier_pos',
                to='orders.proformainvoice',
            ),
        ),
        migrations.RunPython(copy_single_references, migrations.RunPython.noop),
    ]
