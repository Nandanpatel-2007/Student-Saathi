import pytest

from apps.academics.models import Department, Section
from apps.accounts.models import FacultyProfile, Role, StudentProfile, User


@pytest.fixture(autouse=True)
def fast_password_hasher(settings):
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]


@pytest.fixture
def department(db):
    return Department.objects.create(name="Computer Science", code="CSE")


@pytest.fixture
def section(db):
    return Section.objects.create(
        name="A", program="B.Tech CSE", semester=3, academic_year="2025-2026"
    )


@pytest.fixture
def make_user(db):
    def _make(username, role, password="pass12345", **extra):
        return User.objects.create_user(username=username, password=password, role=role, **extra)

    return _make


@pytest.fixture
def admin_user(make_user):
    return make_user("admin1", Role.ADMIN)


@pytest.fixture
def faculty_user(make_user, department):
    user = make_user("fac1", Role.FACULTY, first_name="Fay", last_name="Culty")
    FacultyProfile.objects.create(user=user, employee_id="E001", department=department)
    return user


@pytest.fixture
def student_user(make_user, section):
    user = make_user("stu1", Role.STUDENT, first_name="Stu", last_name="Dent")
    StudentProfile.objects.create(user=user, roll_no="R001", section=section, admission_year=2024)
    return user


@pytest.fixture
def auth_header():
    """Build an Authorization header dict for a user."""
    from ninja_jwt.tokens import RefreshToken

    def _header(user):
        return {"Authorization": f"Bearer {RefreshToken.for_user(user).access_token}"}

    return _header


def as_http_headers(headers: dict) -> dict:
    """Django test client wants HTTP_* keys."""
    return {f"HTTP_{k.upper().replace('-', '_')}": v for k, v in headers.items()}
