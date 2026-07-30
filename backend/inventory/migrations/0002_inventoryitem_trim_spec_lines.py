from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0013_itemindenttemplate_trimmaster_and_more'),
        ('inventory', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='inventoryitem',
            name='trim',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='inventory_items',
                to='orders.trimmaster',
            ),
        ),
        migrations.AddField(
            model_name='inventoryitem',
            name='spec_lines',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Property lines extracted from PO/bill particulars',
            ),
        ),
    ]
