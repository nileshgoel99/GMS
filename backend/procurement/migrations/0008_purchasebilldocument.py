from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('procurement', '0007_purchaseorder_round_off'),
    ]

    operations = [
        migrations.CreateModel(
            name='PurchaseBillDocument',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                (
                    'document_type',
                    models.CharField(
                        choices=[('ORIGINAL_INVOICE', 'Original Invoice'), ('OTHER', 'Other Document')],
                        default='ORIGINAL_INVOICE',
                        max_length=32,
                    ),
                ),
                ('label', models.CharField(blank=True, default='', max_length=120)),
                ('file', models.FileField(upload_to='purchase_bill_docs/%Y/%m/')),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                (
                    'bill',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='documents',
                        to='procurement.purchasebill',
                    ),
                ),
                (
                    'uploaded_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='uploaded_purchase_bill_documents',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'verbose_name': 'Purchase Bill Document',
                'verbose_name_plural': 'Purchase Bill Documents',
                'ordering': ['-uploaded_at', 'id'],
            },
        ),
    ]
