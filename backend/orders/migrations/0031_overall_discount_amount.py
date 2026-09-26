from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0030_overall_discount"),
    ]

    operations = [
        migrations.AddField(
            model_name="buyerpo",
            name="overall_discount_amount",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Fixed overall discount amount, applied after the percent discount",
                max_digits=14,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="proformainvoice",
            name="overall_discount_amount",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Fixed overall discount amount, applied after the percent discount",
                max_digits=14,
                null=True,
            ),
        ),
    ]
