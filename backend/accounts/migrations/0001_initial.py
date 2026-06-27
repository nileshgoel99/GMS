from django.db import migrations, models
import django.db.models.deletion


def create_profiles_for_existing_users(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    UserProfile = apps.get_model('accounts', 'UserProfile')
    for user in User.objects.all():
        if not UserProfile.objects.filter(user_id=user.id).exists():
            role = 'ADMIN' if user.is_superuser else 'MERCHANDISER'
            UserProfile.objects.create(user_id=user.id, role=role)


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(
                    choices=[
                        ('ADMIN', 'Admin'),
                        ('MANAGER', 'Manager'),
                        ('MERCHANDISER', 'Merchandiser'),
                        ('ACCOUNTS', 'Accounts'),
                        ('PURCHASING', 'Purchasing'),
                    ],
                    default='MERCHANDISER',
                    max_length=20,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='profile', to='auth.user')),
            ],
            options={
                'ordering': ['user__username'],
            },
        ),
        migrations.RunPython(create_profiles_for_existing_users, migrations.RunPython.noop),
    ]
