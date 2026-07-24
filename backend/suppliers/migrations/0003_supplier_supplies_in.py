from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('suppliers', '0002_supplier_contact_and_tax_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='supplier',
            name='supplies_in',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Trim names / categories this supplier provides (for segregation & filtering)',
            ),
        ),
    ]
