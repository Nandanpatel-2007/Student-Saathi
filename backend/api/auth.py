"""Authentication and role-based permission helpers.

jwt_auth                         any authenticated user
require_role("FACULTY")          only users with that role (several roles allowed)
has_role(user, "ADMIN")          for object-level checks inside services
"""

from django.core.exceptions import PermissionDenied
from ninja_jwt.authentication import JWTAuth

from apps.accounts.models import Role


class RoleAuth(JWTAuth):
    """JWT auth that additionally requires the user to hold one of ``roles``."""

    def __init__(self, roles: tuple[str, ...]):
        super().__init__()
        self.roles = frozenset(str(r) for r in roles)

    def authenticate(self, request, token):
        user = super().authenticate(request, token)
        if user.role not in self.roles:
            raise PermissionDenied("You do not have permission to perform this action.")
        return user


jwt_auth = JWTAuth()


def require_role(*roles: str | Role) -> RoleAuth:
    if not roles:
        raise ValueError("require_role() needs at least one role")
    return RoleAuth(roles)


def has_role(user, *roles: str | Role) -> bool:
    return user.is_authenticated and user.role in {str(r) for r in roles}
