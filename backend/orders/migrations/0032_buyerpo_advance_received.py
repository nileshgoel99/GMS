from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0031_overall_discount_amount"),
    ]

    operations = [
        migrations.AddField(
            model_name="buyerpo",
            name="advance_received",
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text="Advance already received against this buyer PO",
                max_digits=14,
            ),
        ),
    ]
