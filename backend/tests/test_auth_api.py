from .conftest import PASSWORD, auth_header, login


def test_login_returns_tokens_and_user(client, faculty_user):
    res = login(client, "fac1")
    assert res.status_code == 200
    body = res.json()
    assert body["access"] and body["refresh"]
    assert body["user"] == {"id": faculty_user.id, "name": "Fay Culty", "role": "FACULTY"}


def test_login_wrong_password_uses_standard_error(client, faculty_user):
    res = login(client, "fac1", "nope")
    assert res.status_code == 401
    err = res.json()["error"]
    assert err["code"] == "invalid_credentials"
    assert err["details"] == []


def test_login_inactive_user_rejected(client, student_user):
    student_user.is_active = False
    student_user.save()
    assert login(client, "stu1", PASSWORD).status_code == 401


def test_login_validation_error_format(client):
    res = client.post("/api/v1/auth/login", data={"username": "x"}, content_type="application/json")
    assert res.status_code == 422
    err = res.json()["error"]
    assert err["code"] == "validation_error"
    assert any("password" in (d["field"] or "") for d in err["details"])


def test_me_requires_token(client):
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "unauthorized"


def test_me_rejects_garbage_token(client):
    res = client.get("/api/v1/auth/me", HTTP_AUTHORIZATION="Bearer garbage")
    assert res.status_code == 401
    assert "error" in res.json()


def test_me_returns_current_user(client, student_user):
    res = client.get("/api/v1/auth/me", **auth_header(client, "stu1"))
    assert res.status_code == 200
    assert res.json() == {"id": student_user.id, "name": "Stu Dent", "role": "STUDENT"}


def test_refresh_issues_new_access_token(client, student_user):
    refresh = login(client, "stu1").json()["refresh"]
    res = client.post("/api/v1/auth/refresh", data={"refresh": refresh}, content_type="application/json")
    assert res.status_code == 200
    new_access = res.json()["access"]
    me = client.get("/api/v1/auth/me", HTTP_AUTHORIZATION=f"Bearer {new_access}")
    assert me.status_code == 200


def test_refresh_rejects_invalid_and_access_tokens(client, student_user):
    body = login(client, "stu1").json()
    for bad in ("garbage", body["access"]):
        res = client.post("/api/v1/auth/refresh", data={"refresh": bad}, content_type="application/json")
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "invalid_token"


def test_openapi_docs_available(client):
    assert client.get("/api/v1/openapi.json").status_code == 200
    assert client.get("/api/v1/docs").status_code == 200
