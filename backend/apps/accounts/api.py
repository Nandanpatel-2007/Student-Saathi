from ninja import Router, Status

from api.auth import jwt_auth
from api.errors import ErrorOut, error_payload

from . import services
from .schemas import LoginIn, LoginOut, RefreshIn, RefreshOut, UserOut

router = Router(tags=["Auth"])


@router.post(
    "/login",
    auth=None,
    response={200: LoginOut, 401: ErrorOut},
    summary="Log in with username and password",
    operation_id="auth_login",
)
def login(request, payload: LoginIn):
    try:
        return services.login(payload.username, payload.password)
    except services.InvalidCredentials:
        return Status(401, error_payload("invalid_credentials", "Invalid username or password"))


@router.post(
    "/refresh",
    auth=None,
    response={200: RefreshOut, 401: ErrorOut},
    summary="Exchange a refresh token for a new access token",
    operation_id="auth_refresh",
)
def refresh(request, payload: RefreshIn):
    try:
        return services.refresh_tokens(payload.refresh)
    except services.InvalidRefreshToken:
        return Status(401, error_payload("invalid_token", "Refresh token is invalid or expired"))


@router.get(
    "/me",
    auth=jwt_auth,
    response={200: UserOut, 401: ErrorOut},
    summary="Get the currently logged-in user",
    operation_id="auth_me",
)
def me(request):
    return services.user_summary(request.user)
