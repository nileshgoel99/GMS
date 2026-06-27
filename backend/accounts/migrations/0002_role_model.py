from django.db import migrations, models
import django.db.models.deletion


def seed_roles(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')
    defaults = [
        ('ADMIN', 'Admin', 'Full access to all modules', True, True, []),
        ('MANAGER', 'Manager', 'Indents and stock (inventory)', False, True, ['dashboard', 'indents', 'inventory']),
        ('MERCHANDISER', 'Merchandiser', 'Buyer POs, PIs, and indents', False, True,
         ['dashboard', 'customers', 'buyer_pos', 'pi', 'indents', 'trims']),
        ('ACCOUNTS', 'Accounts', 'Sales (incoming) and purchase bills (outgoing)', False, True,
         ['dashboard', 'sales', 'purchase_bills']),
        ('PURCHASING', 'Purchasing', 'Indents and supplier POs', False, True,
         ['dashboard', 'indents', 'supplier_po', 'suppliers', 'trims']),
    ]
    for code, name, desc, is_admin, is_system, modules in defaults:
        Role.objects.update_or_create(
            code=code,
            defaults={
                'name': name,
                'description': desc,
                'is_admin': is_admin,
                'is_system': is_system,
                'modules': modules,
            },
        )


def migrate_profiles_to_fk(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')
    UserProfile = apps.get_model('accounts', 'UserProfile')
    role_map = {r.code: r.id for r in Role.objects.all()}
    default_id = role_map.get('MERCHANDISER') or next(iter(role_map.values()), None)

    for profile in UserProfile.objects.all():
        old_code = profile.role_old
        profile.role_id = role_map.get(old_code, default_id)
        profile.save(update_fields=['role_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Role',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(db_index=True, max_length=40, unique=True)),
                ('name', models.CharField(max_length=80)),
                ('description', models.TextField(blank=True, default='')),
                ('modules', models.JSONField(blank=True, default=list)),
                ('is_admin', models.BooleanField(default=False)),
                ('is_system', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering': ['name']},
        ),
        migrations.RunPython(seed_roles, migrations.RunPython.noop),
        migrations.RenameField(model_name='userprofile', old_name='role', new_name='role_old'),
        migrations.AddField(
            model_name='userprofile',
            name='role',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT, related_name='users', to='accounts.role'),
        ),
        migrations.RunPython(migrate_profiles_to_fk, migrations.RunPython.noop),
        migrations.RemoveField(model_name='userprofile', name='role_old'),
        migrations.AlterField(
            model_name='userprofile',
            name='role',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='users', to='accounts.role'),
        ),
    ]
