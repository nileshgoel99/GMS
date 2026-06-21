from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('company', '0003_our_bank_currency_banks'),
    ]

    operations = [
        migrations.AddField(
            model_name='companyprofile',
            name='bill_to',
            field=models.TextField(blank=True, default='', help_text='Default Bill To block on supplier purchase orders'),
        ),
        migrations.AddField(
            model_name='companyprofile',
            name='ship_to',
            field=models.TextField(blank=True, default='', help_text='Default Ship To block on supplier purchase orders'),
        ),
    ]
