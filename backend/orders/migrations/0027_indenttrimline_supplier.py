from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0026_buyerpo_ship_to'),
        ('suppliers', '0003_supplier_supplies_in'),
    ]

    operations = [
        migrations.AddField(
            model_name='indenttrimline',
            name='supplier',
            field=models.ForeignKey(
                blank=True,
                help_text='Supplier for this trim line on the indent (not the trim master)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='indent_trim_lines',
                to='suppliers.supplier',
            ),
        ),
    ]
