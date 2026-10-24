import json

import pytest
from ninja_jwt.tokens import RefreshToken

from tests.conftest import as_http_headers

pytestmark = pytest.mark.django_db


def post_json(client, url, data, **extra):
    return client.post(url, data=json.dumps(data), content_type="application/json", **extra)


def test_login_returns_tokens_and_user(client, faculty_user):
    res = post_json(client, "/api/v1/auth/login", {"username": "fac1", "password": "pass12345"})
    assert res.status_code == 200
    body = res.json()
    assert body["access"] and body["refresh"]
    assert body["user"] == {"id": faculty_user.id, "name": "Fay Culty", "role": "FACULTY"}


def test_login_wrong_password_uses_standard_error_format(client, faculty_user):
    res = post_json(client, "/api/v1/auth/login", {"username": "fac1", "password": "nope"})
    assert res.status_code == 401
    assert res.json() == {
        "error": {
            "code": "invalid_credentials",
            "message": "Invalid username or password.",
            "details": None,
        }
    }


def test_login_inactive_user_rejected(client, faculty_user):
    faculty_user.is_active = False
    faculty_user.save()
    res = post_json(client, "/api/v1/auth/login", {"username": "fac1", "password": "pass12345"})
    assert res.status_code == 401


def test_login_validation_error_format(client):
    res = post_json(client, "/api/v1/auth/login", {"username": "x"})
    assert res.status_code == 422
    error = res.json()["error"]
    assert error["code"] == "validation_error"
    assert isinstance(error["details"], list) and error["details"]


def test_refresh_returns_new_access_token(client, student_user):
    refresh = str(RefreshToken.for_user(student_user))
    res = post_json(client, "/api/v1/auth/refresh", {"refresh": refresh})
    assert res.status_code == 200
    assert res.json()["access"]


def test_refresh_rejects_garbage_and_access_tokens(client, student_user):
    res = post_json(client, "/api/v1/auth/refresh", {"refresh": "garbage"})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "invalid_token"
    access = str(RefreshToken.for_user(student_user).access_token)
    assert post_json(client, "/api/v1/auth/refresh", {"refresh": access}).status_code == 401


def test_me_requires_authentication(client):
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "not_authenticated"


def test_me_rejects_invalid_token(client):
    res = client.get("/api/v1/auth/me", HTTP_AUTHORIZATION="Bearer not-a-token")
    assert res.status_code == 401
    assert "error" in res.json()


def test_me_returns_current_user(client, student_user, auth_header):
    res = client.get("/api/v1/auth/me", **as_http_headers(auth_header(student_user)))
    assert res.status_code == 200
    assert res.json() == {
        "id": student_user.id,
        "username": "stu1",
        "email": "",
        "name": "Stu Dent",
        "role": "STUDENT",
    }


def test_openapi_docs_and_schema_available(client):
    assert client.get("/api/v1/docs").status_code == 200
    schema = client.get("/api/v1/openapi.json").json()
    assert {"/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/me"} <= set(schema["paths"])
    assert schema["paths"]["/api/v1/auth/login"]["post"]["operationId"] == "auth_login"
