import pytest

from apps.academics.models import Enrollment, Section, Subject, TeachingAssignment
from apps.accounts.models import FacultyProfile, Role, StudentProfile, User

from .conftest import PASSWORD, call


@pytest.fixture
def world(admin_user, faculty_user, student_user, section, department):
    other_user = User.objects.create_user(
        "stu2", password=PASSWORD, first_name="Zara", last_name="Khan", role=Role.STUDENT
    )
    other_section = Section.objects.create(name="B", program="B.Tech", semester=3, academic_year="2025-2026")
    StudentProfile.objects.create(user=other_user, roll_no="R002", section=other_section, admission_year=2023)
    fac2 = User.objects.create_user("fac2", password=PASSWORD, first_name="Omar", role=Role.FACULTY)
    FacultyProfile.objects.create(user=fac2, employee_id="E002", department=department)
    subject = Subject.objects.create(code="CS301", name="Algorithms", credits=4, semester=3)
    TeachingAssignment.objects.create(faculty=faculty_user.faculty_profile, subject=subject, section=section)
    Enrollment.objects.create(student=student_user.student_profile, subject=subject)
    return {"section": section, "other_section": other_section}


def test_overview_counts(client, world):
    res = call(client, "get", "/admin/overview", "admin1")
    assert res.status_code == 200
    assert res.json() == {
        "students": 2,
        "faculty": 2,
        "subjects": 1,
        "sections": 2,
        "teaching_assignments": 1,
        "enrollments": 1,
    }


def test_overview_on_empty_database(client, admin_user):
    assert set(call(client, "get", "/admin/overview", "admin1").json().values()) == {0}


def test_faculty_lookup_search_and_shape(client, world):
    page = call(client, "get", "/admin/faculty", "admin1").json()
    assert page["count"] == 2 and [f["employee_id"] for f in page["items"]] == ["E001", "E002"]
    first = page["items"][0]
    assert first["name"] == "Fay Culty" and first["department"]["code"] == "CS"

    assert [
        f["employee_id"] for f in call(client, "get", "/admin/faculty?search=omar", "admin1").json()["items"]
    ] == ["E002"]
    assert call(client, "get", "/admin/faculty?search=e001", "admin1").json()["count"] == 1
    assert call(client, "get", "/admin/faculty?search=nobody", "admin1").json()["count"] == 0


def test_student_lookup_search_filter_and_pagination(client, world):
    page = call(client, "get", "/admin/students", "admin1").json()
    assert page["count"] == 2
    assert page["items"][0]["roll_no"] == "R001" and page["items"][0]["section"]["name"] == "A"

    assert (
        call(client, "get", "/admin/students?search=zara", "admin1").json()["items"][0]["roll_no"] == "R002"
    )
    by_section = call(
        client, "get", f"/admin/students?section_id={world['other_section'].id}", "admin1"
    ).json()
    assert [s["roll_no"] for s in by_section["items"]] == ["R002"]
    paged = call(client, "get", "/admin/students?page_size=1", "admin1").json()
    assert len(paged["items"]) == 1 and paged["total_pages"] == 2


@pytest.mark.parametrize("path", ["/admin/overview", "/admin/faculty", "/admin/students"])
def test_admin_endpoints_reject_everyone_else(client, world, path):
    assert call(client, "get", path, "fac1").status_code == 403
    assert call(client, "get", path, "stu1").status_code == 403
    assert call(client, "get", path).status_code == 401


def test_admin_lookups_do_not_n_plus_one(client, world, django_assert_max_num_queries):
    from django.test import Client

    headers = {}
    token = call(client, "post", "/auth/login", None, {"username": "admin1", "password": PASSWORD})
    assert token.status_code == 200
    headers["HTTP_AUTHORIZATION"] = f"Bearer {token.json()['access']}"
    with django_assert_max_num_queries(6):
        assert Client().get("/api/v1/admin/students", **headers).json()["count"] == 2
    with django_assert_max_num_queries(6):
        assert Client().get("/api/v1/admin/faculty", **headers).json()["count"] == 2


def test_sections_can_be_searched_by_admin(client, world):
    found = call(client, "get", "/sections?search=b.tech", "admin1").json()
    assert found["count"] == 2
    assert call(client, "get", "/sections?search=zzz", "admin1").json()["count"] == 0
    assert (
        call(client, "get", "/sections?search=B", "admin1").json()["count"] == 2
    )  # name B or program B.Tech


def test_admin_crud_lists_do_not_n_plus_one(client, world, section, django_assert_max_num_queries):
    from apps.academics.models import Subject, TeachingAssignment

    faculty = FacultyProfile.objects.get(employee_id="E001")
    for i in range(12):
        subject = Subject.objects.create(code=f"X{i}", name=f"Extra {i}", credits=2, semester=3)
        TeachingAssignment.objects.create(faculty=faculty, subject=subject, section=section)
        Enrollment.objects.create(student=StudentProfile.objects.get(roll_no="R001"), subject=subject)

    token = call(client, "post", "/auth/login", None, {"username": "admin1", "password": PASSWORD}).json()[
        "access"
    ]
    headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
    for path in ("/teaching-assignments", "/enrollments", "/subjects", "/sections"):
        with django_assert_max_num_queries(6):
            assert client.get(f"/api/v1{path}?page_size=50", **headers).status_code == 200
