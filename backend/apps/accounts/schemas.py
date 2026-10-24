from ninja import Schema


class LoginIn(Schema):
    username: str
    password: str


class UserBriefOut(Schema):
    id: int
    name: str
    role: str


class LoginOut(Schema):
    access: str
    refresh: str
    user: UserBriefOut


class RefreshIn(Schema):
    refresh: str


class RefreshOut(Schema):
    access: str


class MeOut(Schema):
    id: int
    username: str
    email: str
    name: str
    role: str
