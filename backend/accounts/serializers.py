import re

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Role
from .role_utils import get_role_for_user, modules_for_role_obj
from .roles import ALL_MODULES, MODULE_KEYS


def _slug_code(name):
    code = re.sub(r'[^A-Z0-9]+', '_', name.upper()).strip('_')
    return code[:40] or 'ROLE'


class RoleSerializer(serializers.ModelSerializer):
    user_count = serializers.SerializerMethodField()
    module_labels = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = [
            'id', 'code', 'name', 'description', 'modules', 'module_labels',
            'is_admin', 'is_system', 'user_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'is_system', 'user_count', 'module_labels', 'created_at', 'updated_at']

    def get_user_count(self, obj):
        return obj.users.count()

    def get_module_labels(self, obj):
        labels = dict(ALL_MODULES)
        if obj.is_admin:
            return ['All modules']
        return [labels.get(m, m) for m in (obj.modules or [])]

    def validate_modules(self, value):
        invalid = [m for m in (value or []) if m not in MODULE_KEYS]
        if invalid:
            raise serializers.ValidationError(f'Unknown modules: {", ".join(invalid)}')
        return value or []


class RoleWriteSerializer(serializers.ModelSerializer):
    code = serializers.CharField(max_length=40, required=False, allow_blank=True)

    class Meta:
        model = Role
        fields = ['code', 'name', 'description', 'modules', 'is_admin']

    def validate_modules(self, value):
        invalid = [m for m in (value or []) if m not in MODULE_KEYS]
        if invalid:
            raise serializers.ValidationError(f'Unknown modules: {", ".join(invalid)}')
        return value or []

    def validate(self, attrs):
        is_admin = attrs.get('is_admin', getattr(self.instance, 'is_admin', False))
        if is_admin:
            attrs['modules'] = []
        elif not attrs.get('modules') and not (self.instance and self.instance.modules):
            if not is_admin:
                raise serializers.ValidationError({'modules': 'Select at least one module, or mark as Admin role.'})
        return attrs

    def create(self, validated_data):
        code = validated_data.get('code') or _slug_code(validated_data['name'])
        validated_data['code'] = code
        if Role.objects.filter(code__iexact=code).exists():
            raise serializers.ValidationError({'code': 'Role code already exists.'})
        return Role.objects.create(**validated_data)

    def update(self, instance, validated_data):
        if instance.is_system and validated_data.get('is_admin') is False and instance.is_admin:
            raise serializers.ValidationError('Cannot remove admin flag from a system role.')
        if 'code' in validated_data and not validated_data['code']:
            validated_data.pop('code')
        if validated_data.get('is_admin'):
            validated_data['modules'] = []
        return super().update(instance, validated_data)


class UserListSerializer(serializers.ModelSerializer):
    role_id = serializers.IntegerField(source='profile.role_id', read_only=True)
    role = serializers.CharField(source='profile.role.code', read_only=True)
    role_label = serializers.CharField(source='profile.role.name', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'is_active',
            'role_id', 'role', 'role_label', 'last_login', 'date_joined',
        ]
        read_only_fields = fields


class UserCreateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True, default='')
    first_name = serializers.CharField(required=False, allow_blank=True, default='')
    last_name = serializers.CharField(required=False, allow_blank=True, default='')
    password = serializers.CharField(write_only=True, min_length=8)
    role_id = serializers.IntegerField()
    is_active = serializers.BooleanField(default=True)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('Username already exists.')
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate_role_id(self, value):
        if not Role.objects.filter(pk=value).exists():
            raise serializers.ValidationError('Invalid role.')
        return value

    def create(self, validated_data):
        role_id = validated_data.pop('role_id')
        is_active = validated_data.pop('is_active', True)
        password = validated_data.pop('password')
        user = User(**validated_data, is_active=is_active)
        user.set_password(password)
        user.save()
        user.profile.role_id = role_id
        user.profile.save(update_fields=['role_id', 'updated_at'])
        return user


class UserUpdateSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    role_id = serializers.IntegerField(required=False)
    is_active = serializers.BooleanField(required=False)
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    def validate_password(self, value):
        if value:
            validate_password(value)
        return value

    def validate_role_id(self, value):
        if not Role.objects.filter(pk=value).exists():
            raise serializers.ValidationError('Invalid role.')
        return value

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        role_id = validated_data.pop('role_id', None)

        for attr, val in validated_data.items():
            setattr(instance, attr, val)

        if password:
            instance.set_password(password)

        instance.save()

        if role_id is not None:
            instance.profile.role_id = role_id
            instance.profile.save(update_fields=['role_id', 'updated_at'])

        return instance


class MeUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['first_name', 'last_name']


class MeSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    role_id = serializers.SerializerMethodField()
    role_label = serializers.SerializerMethodField()
    modules = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'role_id', 'role_label', 'modules', 'is_admin']

    def get_role_obj(self, obj):
        return get_role_for_user(obj)

    def get_role(self, obj):
        role = self.get_role_obj(obj)
        return role.code if role else 'MERCHANDISER'

    def get_role_id(self, obj):
        role = self.get_role_obj(obj)
        return role.id if role else None

    def get_role_label(self, obj):
        role = self.get_role_obj(obj)
        return role.name if role else 'Merchandiser'

    def get_modules(self, obj):
        role = self.get_role_obj(obj)
        mods = modules_for_role_obj(role)
        return sorted(mods) if mods is not None else ['*']

    def get_is_admin(self, obj):
        role = self.get_role_obj(obj)
        return obj.is_superuser or bool(role and role.is_admin)


class ModuleListSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
