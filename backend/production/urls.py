from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProductionIssueViewSet, ProductionReturnViewSet,
    CuttingRecordViewSet, FabricRollViewSet,
)

router = DefaultRouter()
router.register(r'issues', ProductionIssueViewSet, basename='production-issue')
router.register(r'returns', ProductionReturnViewSet, basename='production-return')
router.register(r'cuttings', CuttingRecordViewSet, basename='cutting-record')
router.register(r'rolls', FabricRollViewSet, basename='fabric-roll')

urlpatterns = [
    path('', include(router.urls)),
]
