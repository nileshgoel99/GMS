from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0029_buyerpo_pi_stale"),
    ]

    operations = [
        migrations.AddField(
            model_name="buyerpo",
            name="overall_discount",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Overall discount % applied after line discounts (0–100)",
                max_digits=5,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="proformainvoice",
            name="overall_discount",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Overall discount % applied after line values (0–100)",
                max_digits=5,
                null=True,
            ),
        ),
    ]
