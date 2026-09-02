import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("inventory", "0004_backfill_transaction_date"),
    ]

    operations = [
        migrations.CreateModel(
            name="InventoryItemAudit",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("item_code", models.CharField(db_index=True, max_length=50)),
                ("item_name", models.CharField(blank=True, default="", max_length=200)),
                (
                    "action",
                    models.CharField(choices=[("UPDATE", "Updated"), ("DELETE", "Deleted")], max_length=20),
                ),
                (
                    "changes",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Field diffs: {field: {old, new}} or a snapshot on delete",
                    ),
                ),
                ("performed_at", models.DateTimeField(auto_now_add=True)),
                (
                    "item",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="audits",
                        to="inventory.inventoryitem",
                    ),
                ),
                (
                    "performed_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="inventory_item_audits",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Inventory item audit",
                "verbose_name_plural": "Inventory item audits",
                "ordering": ["-performed_at"],
            },
        ),
    ]
