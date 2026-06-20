from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('suppliers', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='supplier',
            name='city',
            field=models.CharField(blank=True, default='', max_length=120),
        ),
        migrations.AddField(
            model_name='supplier',
            name='contact_person',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='supplier',
            name='currency',
            field=models.CharField(blank=True, default='', help_text='Preferred invoicing currency for international suppliers (e.g. USD, EUR)', max_length=10),
        ),
        migrations.AddField(
            model_name='supplier',
            name='email',
            field=models.EmailField(blank=True, default='', max_length=254),
        ),
        migrations.AddField(
            model_name='supplier',
            name='is_international',
            field=models.BooleanField(default=False, help_text='International suppliers may use VAT/EIN or other tax identifiers'),
        ),
        migrations.AddField(
            model_name='supplier',
            name='phone',
            field=models.CharField(blank=True, default='', max_length=40),
        ),
        migrations.AddField(
            model_name='supplier',
            name='postal_code',
            field=models.CharField(blank=True, default='', max_length=30),
        ),
        migrations.AddField(
            model_name='supplier',
            name='state_province',
            field=models.CharField(blank=True, default='', max_length=120),
        ),
        migrations.AddField(
            model_name='supplier',
            name='tax_id_type',
            field=models.CharField(blank=True, default='', help_text='GST, VAT, EIN, Company Reg No, etc.', max_length=40),
        ),
        migrations.AddField(
            model_name='supplier',
            name='website',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AlterField(
            model_name='supplier',
            name='gst',
            field=models.CharField(blank=True, default='', help_text='GST number (India) or tax / registration ID for overseas suppliers', max_length=80),
        ),
    ]
