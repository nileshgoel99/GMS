from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('production', '0004_cutting_roll_meters'),
    ]

    operations = [
        migrations.CreateModel(
            name='FabricRoll',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('roll_no', models.CharField(db_index=True, max_length=100, unique=True)),
                ('original_meters', models.DecimalField(
                    decimal_places=4, default=0, max_digits=14,
                    help_text='Meters when the roll was first recorded',
                )),
                ('current_balance', models.DecimalField(
                    decimal_places=4, default=0, max_digits=14,
                    help_text='Remaining meters after last cutting (used + rejected deducted)',
                )),
                ('fabric', models.CharField(blank=True, default='', max_length=500)),
                ('color', models.CharField(blank=True, default='', max_length=120)),
                ('unit', models.CharField(default='MTRS', max_length=20)),
                ('notes', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Fabric Roll',
                'verbose_name_plural': 'Fabric Rolls',
                'ordering': ['roll_no'],
            },
        ),
        migrations.AlterField(
            model_name='cuttingrecord',
            name='roll_numbers',
            field=models.JSONField(
                blank=True, default=list,
                help_text=(
                    'Rolls used: [{"roll_no": "R-101", "total_meters": "120", '
                    '"used_meters": "45.5", "rejected_meters": "1.5"}]'
                ),
            ),
        ),
    ]
