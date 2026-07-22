"""Authentication backends for FabriFlow accounts."""

from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend


class CaseInsensitiveModelBackend(ModelBackend):
    """Treat username as case-insensitive (shivangi == Shivangi)."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        UserModel = get_user_model()
        if username is None:
            username = kwargs.get(UserModel.USERNAME_FIELD)
        if username is None or password is None:
            return None

        username = str(username).strip()
        if not username:
            return None

        field = f'{UserModel.USERNAME_FIELD}__iexact'
        try:
            user = UserModel._default_manager.get(**{field: username})
        except UserModel.DoesNotExist:
            # Run the default password hasher once to mitigate timing attacks
            UserModel().set_password(password)
            return None
        except UserModel.MultipleObjectsReturned:
            user = (
                UserModel._default_manager
                .filter(**{field: username})
                .order_by('id')
                .first()
            )
            if user is None:
                return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
