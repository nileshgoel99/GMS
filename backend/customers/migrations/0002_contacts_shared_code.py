# Generated manually for shared customer codes + contacts

from django.db import migrations, models
import django.db.models.deletion


def migrate_legacy_contacts(apps, schema_editor):
    Customer = apps.get_model('customers', 'Customer')
    CustomerContact = apps.get_model('customers', 'CustomerContact')
    for customer in Customer.objects.all():
        name = (customer.company_legal_name or 'Primary contact').strip()[:120]
        email = customer.primary_email or ''
        phone = customer.phone or customer.mobile or ''
        if not email and not phone and not customer.primary_email:
            continue
        if CustomerContact.objects.filter(customer=customer).exists():
            continue
        CustomerContact.objects.create(
            customer=customer,
            name=name,
            email=email,
            phone=phone,
            designation='',
            is_primary=True,
            sort_order=0,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='customer',
            name='customer_code',
            field=models.CharField(db_index=True, max_length=40),
        ),
        migrations.CreateModel(
            name='CustomerContact',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('email', models.EmailField(blank=True, default='', max_length=254)),
                ('phone', models.CharField(blank=True, default='', max_length=40)),
                ('designation', models.CharField(blank=True, default='', max_length=120)),
                ('is_primary', models.BooleanField(default=False)),
                ('sort_order', models.PositiveSmallIntegerField(default=0)),
                (
                    'customer',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='contacts',
                        to='customers.customer',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Customer contact',
                'verbose_name_plural': 'Customer contacts',
                'ordering': ['-is_primary', 'sort_order', 'id'],
            },
        ),
        migrations.RunPython(migrate_legacy_contacts, migrations.RunPython.noop),
    ]
