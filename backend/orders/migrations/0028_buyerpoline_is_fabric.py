from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0027_indenttrimline_supplier"),
    ]

    operations = [
        migrations.AddField(
            model_name="buyerpoline",
            name="is_fabric",
            field=models.BooleanField(
                default=False,
                help_text="Fabric-only line: total qty in metres, no size breakdown",
            ),
        ),
        migrations.AlterField(
            model_name="buyerpoline",
            name="quantity",
            field=models.DecimalField(
                decimal_places=3,
                default=0,
                help_text="Total pieces (auto-sum from sizes) or metres for fabric lines",
                max_digits=12,
            ),
        ),
        migrations.AlterField(
            model_name="buyerpo",
            name="total_qty",
            field=models.DecimalField(decimal_places=3, default=0, max_digits=14),
        ),
        migrations.AlterField(
            model_name="buyerpoline",
            name="uom",
            field=models.CharField(
                blank=True,
                default="PCS",
                help_text="Unit of measure, e.g. PCS, DZ, MTRS",
                max_length=20,
            ),
        ),
    ]
