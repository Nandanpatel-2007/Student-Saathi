from ninja import Schema


class LoginIn(Schema):
    username: str
    password: str


class RefreshIn(Schema):
    refresh: str


class UserOut(Schema):
    id: int
    name: str
    role: str


class LoginOut(Schema):
    access: str
    refresh: str
    user: UserOut


class RefreshOut(Schema):
    access: str
    refresh: str | None = None
