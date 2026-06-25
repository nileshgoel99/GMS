from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0018_sales_entry'),
    ]

    operations = [
        migrations.AddField(
            model_name='indentfabricline',
            name='gsm',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Fabric weight e.g. 245 GSM',
                max_length=50,
            ),
        ),
    ]
