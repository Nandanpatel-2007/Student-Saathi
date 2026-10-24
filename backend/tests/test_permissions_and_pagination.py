import pytest
from ninja import NinjaAPI, Router
from ninja.pagination import paginate
from ninja.testing import TestClient

from api.auth import require_role
from api.errors import register_error_handlers
from api.pagination import StandardPagination
from apps.accounts.models import Role, User

from .conftest import auth_header

# A throwaway API so Phase 1 can exercise role checks and pagination before real endpoints exist.
test_api = NinjaAPI(urls_namespace="phase1-tests")
register_error_handlers(test_api)
router = Router()


@router.get("/faculty-only", auth=require_role(Role.FACULTY))
def faculty_only(request):
    return {"ok": True}


@router.get("/staff", auth=require_role(Role.FACULTY, Role.ADMIN))
def staff(request):
    return {"ok": True}


@router.get("/users", response=list[dict], auth=None)
@paginate(StandardPagination)
def users(request):
    return list(User.objects.order_by("id").values("id", "username"))


test_api.add_router("", router)


@pytest.fixture
def api_client(client):
    """Same-process TestClient with a real JWT header taken from the login endpoint."""

    def call(path, username=None):
        headers = auth_header(client, username) if username else {}
        return TestClient(test_api).get(
            path, headers={"Authorization": headers["HTTP_AUTHORIZATION"]} if headers else {}
        )

    return call


def test_role_allowed(api_client, faculty_user):
    assert api_client("/faculty-only", "fac1").status_code == 200


def test_role_forbidden_uses_standard_error(api_client, student_user):
    res = api_client("/faculty-only", "stu1")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "forbidden"


def test_multiple_roles(api_client, admin_user, student_user):
    assert api_client("/staff", "admin1").status_code == 200
    assert api_client("/staff", "stu1").status_code == 403


def test_unauthenticated_is_401(api_client, db):
    assert api_client("/faculty-only").status_code == 401


def test_pagination_shape_and_limits(api_client, db, settings):
    settings.MAX_PAGE_SIZE = 5
    for i in range(12):
        User.objects.create_user(f"p{i}", password="x")

    body = api_client("/users?page_size=5").json()
    assert body["count"] == 12
    assert body["page"] == 1 and body["page_size"] == 5 and body["total_pages"] == 3
    assert len(body["items"]) == 5

    last = api_client("/users?page=3&page_size=5").json()
    assert len(last["items"]) == 2

    capped = api_client("/users?page_size=999").json()
    assert capped["page_size"] == 5


def test_pagination_empty(api_client, db):
    body = api_client("/users").json()
    assert body["count"] == 0 and body["items"] == [] and body["total_pages"] == 0
