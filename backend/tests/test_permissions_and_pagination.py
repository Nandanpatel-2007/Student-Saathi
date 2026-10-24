"""Exercises require_role, the error handlers and pagination on a throwaway API."""

import pytest
from ninja import NinjaAPI, Router, Schema
from ninja.pagination import paginate
from ninja.testing import TestClient

from api.auth import has_role, jwt_auth, require_role
from api.errors import APIError, register_exception_handlers
from apps.accounts.models import Role, User

pytestmark = pytest.mark.django_db


class UserOut(Schema):
    id: int
    username: str


router = Router()


@router.get("/faculty-only", auth=require_role("FACULTY"))
def faculty_only(request):
    return {"ok": True}


@router.get("/staff", auth=require_role(Role.FACULTY, Role.ADMIN))
def staff(request):
    return {"ok": True}


@router.get("/boom")
def boom(request):
    raise APIError(409, message="Already exists.", details={"field": "roll_no"})


@router.get("/users", response=list[UserOut])
@paginate
def users(request):
    return User.objects.order_by("id")


test_api = NinjaAPI(urls_namespace="test_phase1", auth=jwt_auth)
register_exception_handlers(test_api)
test_api.add_router("", router)
client = TestClient(test_api)


def test_require_role_allows_matching_role(faculty_user, auth_header):
    assert client.get("/faculty-only", headers=auth_header(faculty_user)).status_code == 200


def test_require_role_forbids_other_roles(student_user, admin_user, auth_header):
    for user in (student_user, admin_user):
        res = client.get("/faculty-only", headers=auth_header(user))
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "permission_denied"


def test_require_role_accepts_any_of_several_roles(
    student_user, faculty_user, admin_user, auth_header
):
    assert client.get("/staff", headers=auth_header(faculty_user)).status_code == 200
    assert client.get("/staff", headers=auth_header(admin_user)).status_code == 200
    assert client.get("/staff", headers=auth_header(student_user)).status_code == 403


def test_require_role_without_token_is_401():
    assert client.get("/faculty-only").status_code == 401


def test_require_role_needs_at_least_one_role():
    with pytest.raises(ValueError):
        require_role()


def test_has_role(student_user, faculty_user):
    assert has_role(student_user, "STUDENT")
    assert has_role(faculty_user, Role.FACULTY, Role.ADMIN)
    assert not has_role(student_user, Role.FACULTY)


def test_api_error_uses_standard_format(admin_user, auth_header):
    res = client.get("/boom", headers=auth_header(admin_user))
    assert res.status_code == 409
    assert res.json() == {
        "error": {"code": "conflict", "message": "Already exists.", "details": {"field": "roll_no"}}
    }


def test_pagination_envelope_and_defaults(make_user, admin_user, auth_header):
    for i in range(24):
        make_user(f"u{i}", Role.STUDENT)  # 25 users total with admin_user
    res = client.get("/users", headers=auth_header(admin_user))
    body = res.json()
    assert res.status_code == 200
    assert (body["count"], body["page"], body["page_size"], body["total_pages"]) == (25, 1, 20, 2)
    assert len(body["items"]) == 20

    page2 = client.get("/users?page=2", headers=auth_header(admin_user)).json()
    assert len(page2["items"]) == 5 and page2["page"] == 2


def test_pagination_page_size_is_capped(admin_user, auth_header, settings):
    settings.PAGINATION_MAX_PAGE_SIZE = 5
    body = client.get("/users?page_size=500", headers=auth_header(admin_user)).json()
    assert body["page_size"] == 5


def test_pagination_rejects_bad_page(admin_user, auth_header):
    res = client.get("/users?page=0", headers=auth_header(admin_user))
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "validation_error"
