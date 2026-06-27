from .models import Role

# Modules granted when another module is assigned (e.g. indents → trims for BOM work).
IMPLIED_MODULE_ACCESS = {
    'trims': ['indents'],
}


def get_role_for_user(user):
    if not user or not user.is_authenticated:
        return None
    if user.is_superuser:
        return Role.objects.filter(is_admin=True).first()
    profile = getattr(user, 'profile', None)
    if profile and profile.role_id:
        return profile.role
    return Role.objects.filter(code='MERCHANDISER').first()


def modules_for_role_obj(role):
    if not role:
        return set()
    if role.is_admin:
        return None
    modules = set(role.modules or [])
    for module, required in IMPLIED_MODULE_ACCESS.items():
        if any(r in modules for r in required):
            modules.add(module)
    return modules


def role_has_module(role, module, *, is_superuser=False):
    if is_superuser:
        return True
    if not role:
        return False
    if role.is_admin:
        return True
    modules = set(role.modules or [])
    if module in modules:
        return True
    required = IMPLIED_MODULE_ACCESS.get(module)
    if required and any(r in modules for r in required):
        return True
    return False


def user_is_admin(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    role = get_role_for_user(user)
    return bool(role and role.is_admin)
