from django.conf import settings
from django.contrib.auth import authenticate
from ninja_jwt.exceptions import TokenError
from ninja_jwt.tokens import RefreshToken

from .models import User


class InvalidCredentials(Exception):
    pass


class InvalidRefreshToken(Exception):
    pass


def user_summary(user: User) -> dict:
    return {"id": user.id, "name": user.display_name, "role": user.role}


def login(username: str, password: str) -> dict:
    user = authenticate(username=username, password=password)
    if user is None or not user.is_active:
        raise InvalidCredentials
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": user_summary(user),
    }


def refresh_tokens(refresh_token: str) -> dict:
    try:
        refresh = RefreshToken(refresh_token)
        user = User.objects.filter(pk=refresh["user_id"], is_active=True).first()
        if user is None:
            raise InvalidRefreshToken
        result = {"access": str(refresh.access_token)}
        # Rotation (if enabled in NINJA_JWT) hands back a replacement refresh token.
        if settings.NINJA_JWT.get("ROTATE_REFRESH_TOKENS"):
            refresh.set_jti()
            refresh.set_exp()
            refresh.set_iat()
            result["refresh"] = str(refresh)
        return result
    except (TokenError, KeyError) as exc:
        raise InvalidRefreshToken from exc
