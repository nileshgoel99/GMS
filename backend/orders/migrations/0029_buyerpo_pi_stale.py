from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0028_buyerpoline_is_fabric"),
    ]

    operations = [
        migrations.AddField(
            model_name="buyerpo",
            name="pi_stale",
            field=models.BooleanField(
                default=False,
                help_text="True when this PO changed after the linked PI was generated",
            ),
        ),
    ]
