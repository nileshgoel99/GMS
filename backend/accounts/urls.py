from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import RoleViewSet, UserViewSet, me_view, modules_list_view

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='gms-user')
router.register(r'roles', RoleViewSet, basename='gms-role')

urlpatterns = [
    path('me/', me_view, name='me'),
    path('modules/', modules_list_view, name='modules-list'),
    path('', include(router.urls)),
]
