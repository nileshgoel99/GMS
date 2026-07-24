from django.db import migrations, models


def seed_from_profile(apps, schema_editor):
    CompanyProfile = apps.get_model('company', 'CompanyProfile')
    CompanyBankAccount = apps.get_model('company', 'CompanyBankAccount')
    profile = CompanyProfile.objects.filter(pk=1).first()
    if not profile:
        return
    details = (profile.our_bank_details or '').strip()
    if not details:
        return
    if CompanyBankAccount.objects.exists():
        return
    CompanyBankAccount.objects.create(
        name='Primary bank',
        bank_details=details,
        is_default=True,
        sort_order=0,
    )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('company', '0004_company_bill_ship_to'),
    ]

    operations = [
        migrations.CreateModel(
            name='CompanyBankAccount',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text='Short label, e.g. PNB Kanpur / HDFC Current', max_length=120)),
                ('bank_details', models.TextField(help_text='Full bank block printed on the PI (name, branch, A/C, IFSC/SWIFT, …)')),
                ('is_default', models.BooleanField(default=False, help_text='Pre-selected on Generate PI when no other preference is stored')),
                ('sort_order', models.PositiveSmallIntegerField(default=0)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Company bank account',
                'verbose_name_plural': 'Company bank accounts',
                'ordering': ['sort_order', 'name', 'id'],
            },
        ),
        migrations.RunPython(seed_from_profile, noop_reverse),
    ]
