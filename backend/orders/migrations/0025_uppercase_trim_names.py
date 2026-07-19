from django.db import migrations


def uppercase_trim_names(apps, schema_editor):
    TrimMaster = apps.get_model('orders', 'TrimMaster')
    IndentTrimLine = apps.get_model('orders', 'IndentTrimLine')

    for trim in TrimMaster.objects.all():
        upper = (trim.name or '').strip().upper()
        if upper != trim.name:
            # Avoid unique-constraint collisions if both cased variants exist.
            if TrimMaster.objects.filter(name=upper).exclude(pk=trim.pk).exists():
                continue
            trim.name = upper
            trim.save(update_fields=['name'])

    for line in IndentTrimLine.objects.all():
        upper = (line.trim_name or '').strip().upper()
        if upper != line.trim_name:
            line.trim_name = upper
            line.save(update_fields=['trim_name'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0024_alter_indent_carton_boxes'),
    ]

    operations = [
        migrations.RunPython(uppercase_trim_names, noop),
    ]
