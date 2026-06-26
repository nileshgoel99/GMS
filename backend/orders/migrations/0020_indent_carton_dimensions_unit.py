from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0019_indentfabricline_gsm'),
    ]

    operations = [
        migrations.AddField(
            model_name='indent',
            name='carton_dimensions_unit',
            field=models.CharField(
                blank=True,
                choices=[('CMS', 'Centimetres'), ('INCH', 'Inches')],
                default='CMS',
                max_length=10,
            ),
        ),
    ]
