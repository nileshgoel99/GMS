from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0016_trimmaster_supplier'),
    ]

    operations = [
        migrations.AddField(
            model_name='trimmaster',
            name='hsn_code',
            field=models.CharField(blank=True, default='', help_text='Default HSN/SAC for PO lines', max_length=20),
        ),
    ]
