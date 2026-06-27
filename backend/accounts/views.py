from django.contrib.auth.models import User
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Role
from .permissions import IsAdminRole
from .roles import ALL_MODULES
from .serializers import (
    MeSerializer,
    MeUpdateSerializer,
    ModuleListSerializer,
    RoleSerializer,
    RoleWriteSerializer,
    UserCreateSerializer,
    UserListSerializer,
    UserUpdateSerializer,
)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def me_view(request):
    if request.method == 'GET':
        return Response(MeSerializer(request.user).data)
    serializer = MeUpdateSerializer(request.user, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(MeSerializer(request.user).data)


@api_view(['GET'])
@permission_classes([IsAdminRole])
def modules_list_view(request):
    data = [{'key': k, 'label': lbl} for k, lbl in ALL_MODULES]
    return Response(ModuleListSerializer(data, many=True).data)


class RoleViewSet(viewsets.ModelViewSet):
    """Admin-only role management."""
    permission_classes = [IsAdminRole]
    queryset = Role.objects.all().order_by('name')
    search_fields = ['name', 'code', 'description']

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return RoleWriteSerializer
        return RoleSerializer

    def perform_destroy(self, instance):
        if instance.is_system:
            raise ValidationError('System roles cannot be deleted.')
        if instance.users.exists():
            raise ValidationError('Cannot delete a role that is assigned to users.')
        instance.delete()


class UserViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Admin-only user management."""
    permission_classes = [IsAdminRole]
    queryset = User.objects.select_related('profile', 'profile__role').order_by('username')
    search_fields = ['username', 'email', 'first_name', 'last_name']

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        if self.action in ('update', 'partial_update'):
            return UserUpdateSerializer
        return UserListSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        user = User.objects.select_related('profile', 'profile__role').get(pk=user.pk)
        return Response(UserListSerializer(user).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        user = User.objects.select_related('profile', 'profile__role').get(pk=user.pk)
        return Response(UserListSerializer(user).data)

    partial_update = update
