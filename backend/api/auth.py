"""Authentication class and role-based permission helpers.

@router.get("/x", auth=require_role(Role.FACULTY))   # one or more roles
@router.get("/y", auth=jwt_auth)                     # any logged-in user
"""

from django.core.exceptions import PermissionDenied
from ninja_jwt.authentication import JWTAuth

from apps.accounts.models import Role


class RoleAuth(JWTAuth):
    """JWT auth that additionally requires the user's role to be in `roles`."""

    def __init__(self, *roles: str):
        super().__init__()
        self.roles = frozenset(str(r) for r in roles)

    def authenticate(self, request, token):
        user = super().authenticate(request, token)
        if self.roles and user.role not in self.roles:
            raise PermissionDenied("You do not have permission to perform this action")
        return user


jwt_auth = JWTAuth()


def require_role(*roles: str) -> RoleAuth:
    return RoleAuth(*roles)


admin_only = require_role(Role.ADMIN)
faculty_or_admin = require_role(Role.FACULTY, Role.ADMIN)
