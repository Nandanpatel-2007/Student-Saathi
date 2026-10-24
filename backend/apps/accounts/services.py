from django.contrib.auth import authenticate
from ninja_jwt.exceptions import TokenError
from ninja_jwt.settings import api_settings
from ninja_jwt.tokens import RefreshToken

from api.errors import APIError

from .models import User


def login(username: str, password: str) -> tuple[User, str, str]:
    """Verify credentials and issue a token pair."""
    user = authenticate(username=username, password=password)
    if user is None or not user.is_active:
        raise APIError(401, "invalid_credentials", "Invalid username or password.")
    refresh = RefreshToken.for_user(user)
    return user, str(refresh.access_token), str(refresh)


def refresh_access_token(refresh_token: str) -> str:
    """Exchange a valid refresh token for a new access token."""
    try:
        token = RefreshToken(refresh_token)
    except TokenError as exc:
        raise APIError(401, "invalid_token", "Refresh token is invalid or expired.") from exc
    user_id = token[api_settings.USER_ID_CLAIM]
    if not User.objects.filter(pk=user_id, is_active=True).exists():
        raise APIError(401, "invalid_token", "Refresh token is invalid or expired.")
    return str(token.access_token)
