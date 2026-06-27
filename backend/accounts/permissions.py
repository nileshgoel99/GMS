import re

from rest_framework.permissions import BasePermission

from .role_utils import get_role_for_user, role_has_module, user_is_admin

# First match wins — order from most specific to general.
MODULE_ROUTE_RULES = [
    (re.compile(r'^/api/accounts/users/'), 'users'),
    (re.compile(r'^/api/accounts/roles/'), 'users'),
    (re.compile(r'^/api/company/'), 'company'),
    (re.compile(r'^/api/customers/'), 'customers'),
    (re.compile(r'^/api/inventory/'), 'inventory'),
    (re.compile(r'^/api/production/'), 'production'),
    (re.compile(r'^/api/suppliers/'), 'suppliers'),
    (re.compile(r'^/api/procurement/po/'), 'supplier_po'),
    (re.compile(r'^/api/procurement/receipts/'), 'supplier_po'),
    (re.compile(r'^/api/procurement/bills/'), 'purchase_bills'),
    (re.compile(r'^/api/orders/indents/'), 'indents'),
    (re.compile(r'^/api/orders/indent-templates/'), 'indents'),
    (re.compile(r'^/api/orders/buyer-pos/'), 'buyer_pos'),
    (re.compile(r'^/api/orders/sales/'), 'sales'),
    (re.compile(r'^/api/orders/pi/'), 'pi'),
    (re.compile(r'^/api/orders/trims-master/'), 'trims'),
]


def module_for_path(path):
    for pattern, module in MODULE_ROUTE_RULES:
        if pattern.search(path):
            return module
    return None


def user_can_access_module(user, module):
    if not module:
        return True
    role = get_role_for_user(user)
    return role_has_module(role, module, is_superuser=user.is_superuser)


class ModulePermission(BasePermission):
    """Enforce role-based module access from request path."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        path = request.path
        if path.startswith('/api/accounts/me'):
            return True

        module = module_for_path(path)
        if module is None:
            return True

        return user_can_access_module(user, module)


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return user_is_admin(request.user)
