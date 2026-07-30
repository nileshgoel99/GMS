from django.db import migrations
from django.db.models.functions import TruncDate


def backfill_transaction_date(apps, schema_editor):
    InventoryLog = apps.get_model('inventory', 'InventoryLog')
    InventoryLog.objects.filter(transaction_date__isnull=True).update(
        transaction_date=TruncDate('created_at'),
    )


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0003_inventorylog_transaction_date'),
    ]

    operations = [
        migrations.RunPython(backfill_transaction_date, migrations.RunPython.noop),
    ]
