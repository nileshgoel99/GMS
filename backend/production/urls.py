from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProductionIssueViewSet, ProductionReturnViewSet

router = DefaultRouter()
router.register(r'issues', ProductionIssueViewSet, basename='production-issue')
router.register(r'returns', ProductionReturnViewSet, basename='production-return')

urlpatterns = [
    path('', include(router.urls)),
]
