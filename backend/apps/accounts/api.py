from ninja import Router

from api.auth import jwt_auth
from api.errors import ErrorOut

from . import services
from .schemas import LoginIn, LoginOut, MeOut, RefreshIn, RefreshOut, UserBriefOut

router = Router(tags=["Auth"])


@router.post(
    "/login",
    auth=None,
    response={200: LoginOut, 401: ErrorOut},
    operation_id="auth_login",
    summary="Log in with username and password",
)
def login(request, payload: LoginIn):
    user, access, refresh = services.login(payload.username, payload.password)
    return LoginOut(
        access=access,
        refresh=refresh,
        user=UserBriefOut(id=user.id, name=user.display_name, role=user.role),
    )


@router.post(
    "/refresh",
    auth=None,
    response={200: RefreshOut, 401: ErrorOut},
    operation_id="auth_refresh",
    summary="Get a new access token from a refresh token",
)
def refresh(request, payload: RefreshIn):
    return RefreshOut(access=services.refresh_access_token(payload.refresh))


@router.get(
    "/me",
    auth=jwt_auth,
    response={200: MeOut, 401: ErrorOut},
    operation_id="auth_me",
    summary="Get the logged-in user",
)
def me(request):
    user = request.auth
    return MeOut(
        id=user.id,
        username=user.username,
        email=user.email,
        name=user.display_name,
        role=user.role,
    )
