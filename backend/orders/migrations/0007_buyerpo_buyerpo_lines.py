from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0002_contacts_shared_code'),
        ('orders', '0006_intent_sheets'),
    ]

    operations = [
        migrations.CreateModel(
            name='BuyerPO',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('po_number', models.CharField(db_index=True, max_length=100, unique=True)),
                ('po_date', models.DateField()),
                ('buyer_name', models.CharField(blank=True, default='', max_length=200)),
                ('buyer_address', models.TextField(blank=True, default='')),
                ('buyer_contact', models.CharField(blank=True, default='', max_length=200)),
                ('supplier_code', models.CharField(blank=True, default='', max_length=50)),
                ('currency', models.CharField(default='USD', max_length=3)),
                ('delivery_terms', models.CharField(blank=True, default='', max_length=200)),
                ('payment_terms', models.TextField(blank=True, default='')),
                ('delivery_method', models.CharField(blank=True, default='', max_length=200)),
                ('freight_terms', models.CharField(blank=True, default='', max_length=200)),
                ('packaging_terms', models.CharField(blank=True, default='', max_length=200)),
                ('ex_factory_date', models.DateField(blank=True, null=True)),
                ('total_qty', models.PositiveIntegerField(default=0)),
                ('total_value', models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ('status', models.CharField(choices=[('RECEIVED', 'Received'), ('ACKNOWLEDGED', 'Acknowledged'), ('IN_PRODUCTION', 'In Production'), ('SHIPPED', 'Shipped'), ('COMPLETED', 'Completed'), ('CANCELLED', 'Cancelled')], default='RECEIVED', max_length=20)),
                ('notes', models.TextField(blank=True, default='')),
                ('customer', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='buyer_pos', to='customers.customer')),
                ('pi', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='buyer_pos', to='orders.proformainvoice')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_buyer_pos', to='auth.user')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Buyer PO',
                'verbose_name_plural': 'Buyer POs',
                'ordering': ['-po_date', '-created_at'],
            },
        ),
        migrations.CreateModel(
            name='BuyerPOLine',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('line_number', models.PositiveIntegerField(default=1)),
                ('item_code', models.CharField(blank=True, default='', max_length=100)),
                ('item_name', models.CharField(max_length=300)),
                ('fabric', models.CharField(blank=True, default='', max_length=500)),
                ('color', models.CharField(blank=True, default='', max_length=120)),
                ('customer_ref', models.CharField(blank=True, default='', max_length=200)),
                ('agreement_no', models.CharField(blank=True, default='', max_length=200)),
                ('size_breakdown', models.JSONField(blank=True, default=list)),
                ('quantity', models.PositiveIntegerField(default=0)),
                ('unit_price', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ('delivery_date', models.DateField(blank=True, null=True)),
                ('line_amount', models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ('notes', models.TextField(blank=True, default='')),
                ('po', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lines', to='orders.buyerpo')),
            ],
            options={
                'ordering': ['po', 'line_number'],
                'unique_together': {('po', 'line_number')},
            },
        ),
    ]
