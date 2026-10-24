import json

import pytest

from apps.academics.models import Enrollment, Section, Subject, TeachingAssignment
from apps.accounts.models import FacultyProfile, Role, StudentProfile, User

from .conftest import PASSWORD, auth_header


def call(client, method, path, user=None, body=None):
    kwargs = auth_header(client, user) if user else {}
    if body is not None:
        kwargs.update(data=json.dumps(body), content_type="application/json")
    return getattr(client, method)(f"/api/v1{path}", **kwargs)


@pytest.fixture
def subject(db):
    return Subject.objects.create(code="CS301", name="Algorithms", credits=4, semester=3)


@pytest.fixture
def subject2(db):
    return Subject.objects.create(code="CS302", name="Databases", credits=3, semester=3)


@pytest.fixture
def other_faculty(db, department):
    user = User.objects.create_user("fac2", password=PASSWORD, role=Role.FACULTY)
    return FacultyProfile.objects.create(user=user, employee_id="E002", department=department)


@pytest.fixture
def other_student(db, section):
    user = User.objects.create_user("stu2", password=PASSWORD, role=Role.STUDENT)
    return StudentProfile.objects.create(user=user, roll_no="R002", section=section, admission_year=2024)


@pytest.fixture
def assignment(faculty_user, subject, section):
    return TeachingAssignment.objects.create(
        faculty=faculty_user.faculty_profile, subject=subject, section=section
    )


# ------------------------------------------------------------------ subjects


def test_admin_subject_crud(client, admin_user):
    body = {"code": "MA101", "name": "Maths", "credits": 4, "semester": 1}
    res = call(client, "post", "/subjects", "admin1", body)
    assert res.status_code == 201
    sid = res.json()["id"]

    assert call(client, "post", "/subjects", "admin1", body).status_code == 409

    body["name"] = "Mathematics"
    res = call(client, "put", f"/subjects/{sid}", "admin1", body)
    assert res.json()["name"] == "Mathematics"

    page = call(client, "get", "/subjects?search=math", "admin1").json()
    assert page["count"] == 1 and page["items"][0]["code"] == "MA101"

    assert call(client, "delete", f"/subjects/{sid}", "admin1").status_code == 204
    assert call(client, "get", f"/subjects/{sid}", "admin1").status_code == 404


def test_subject_validation(client, admin_user):
    res = call(
        client, "post", "/subjects", "admin1", {"code": "X", "name": "Y", "credits": -1, "semester": 1}
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "validation_error"


def test_non_admin_cannot_write_subjects(client, faculty_user, student_user):
    body = {"code": "MA101", "name": "Maths", "credits": 4, "semester": 1}
    for user in ("fac1", "stu1"):
        assert call(client, "post", "/subjects", user, body).status_code == 403
    assert call(client, "post", "/subjects", None, body).status_code == 401


def test_subject_visibility_is_scoped(client, admin_user, faculty_user, student_user, assignment, subject2):
    Enrollment.objects.create(student=student_user.student_profile, subject=assignment.subject)

    assert call(client, "get", "/subjects", "admin1").json()["count"] == 2
    for user in ("fac1", "stu1"):
        items = call(client, "get", "/subjects", user).json()["items"]
        assert [s["code"] for s in items] == ["CS301"]
        assert call(client, "get", f"/subjects/{subject2.id}", user).status_code == 404


def test_delete_subject_in_use_conflicts(client, admin_user, assignment):
    assert call(client, "delete", f"/subjects/{assignment.subject_id}", "admin1").status_code == 409


# ------------------------------------------------------------------ sections


def test_admin_section_crud(client, admin_user):
    body = {"name": "B", "program": "B.Tech", "semester": 3, "academic_year": "2025-2026"}
    res = call(client, "post", "/sections", "admin1", body)
    assert res.status_code == 201
    sid = res.json()["id"]
    assert call(client, "post", "/sections", "admin1", body).status_code == 409
    body["name"] = "C"
    assert call(client, "put", f"/sections/{sid}", "admin1", body).json()["name"] == "C"
    assert call(client, "delete", f"/sections/{sid}", "admin1").status_code == 204


def test_section_scoping_and_delete_protection(client, admin_user, student_user, faculty_user, assignment):
    other = Section.objects.create(name="Z", program="B.Tech", semester=3, academic_year="2025-2026")
    assert call(client, "get", "/sections", "admin1").json()["count"] == 2
    for user in ("stu1", "fac1"):
        assert call(client, "get", "/sections", user).json()["count"] == 1
        assert call(client, "get", f"/sections/{other.id}", user).status_code == 404
    assert (
        call(client, "delete", f"/sections/{student_user.student_profile.section_id}", "admin1").status_code
        == 409
    )


# ------------------------------------------------------------------ enrollments


def test_enrollment_create_duplicate_and_delete(client, admin_user, student_user, subject):
    body = {"student_id": student_user.student_profile.id, "subject_id": subject.id}
    res = call(client, "post", "/enrollments", "admin1", body)
    assert res.status_code == 201
    assert res.json()["student"]["roll_no"] == "R001"
    assert res.json()["subject"]["code"] == "CS301"
    assert call(client, "post", "/enrollments", "admin1", body).status_code == 409
    assert call(client, "delete", f"/enrollments/{res.json()['id']}", "admin1").status_code == 204
    body["subject_id"] = 9999
    assert call(client, "post", "/enrollments", "admin1", body).status_code == 404


def test_student_sees_only_own_enrollments(client, student_user, other_student, subject, subject2):
    mine = Enrollment.objects.create(student=student_user.student_profile, subject=subject)
    theirs = Enrollment.objects.create(student=other_student, subject=subject2)

    items = call(client, "get", "/enrollments", "stu1").json()["items"]
    assert [e["id"] for e in items] == [mine.id]
    assert call(client, "get", f"/enrollments/{theirs.id}", "stu1").status_code == 404
    assert call(client, "get", f"/enrollments/{mine.id}", "stu1").status_code == 200


def test_student_cannot_write_enrollments_and_faculty_cannot_read(
    client, student_user, faculty_user, subject
):
    body = {"student_id": student_user.student_profile.id, "subject_id": subject.id}
    assert call(client, "post", "/enrollments", "stu1", body).status_code == 403
    assert call(client, "get", "/enrollments", "fac1").status_code == 403


def test_bulk_enroll_section_is_idempotent(client, admin_user, student_user, other_student, subject):
    outsider_section = Section.objects.create(
        name="Q", program="B.Tech", semester=3, academic_year="2025-2026"
    )
    user = User.objects.create_user("stu3", password=PASSWORD)
    StudentProfile.objects.create(user=user, roll_no="R003", section=outsider_section, admission_year=2024)

    body = {"section_id": student_user.student_profile.section_id, "subject_id": subject.id}
    res = call(client, "post", "/enrollments/bulk", "admin1", body)
    assert res.status_code == 200
    assert res.json()["enrolled"] == 2 and res.json()["already_enrolled"] == 0
    assert Enrollment.objects.filter(subject=subject).count() == 2

    again = call(client, "post", "/enrollments/bulk", "admin1", body).json()
    assert again["enrolled"] == 0 and again["already_enrolled"] == 2

    assert call(client, "post", "/enrollments/bulk", "stu1", body).status_code == 403
    body["section_id"] = 9999
    assert call(client, "post", "/enrollments/bulk", "admin1", body).status_code == 404


# ------------------------------------------------------------------ teaching assignments


def test_admin_assignment_crud(client, admin_user, faculty_user, other_faculty, subject, section):
    body = {"faculty_id": faculty_user.faculty_profile.id, "subject_id": subject.id, "section_id": section.id}
    res = call(client, "post", "/teaching-assignments", "admin1", body)
    assert res.status_code == 201
    aid = res.json()["id"]
    assert res.json()["faculty"]["employee_id"] == "E001"
    assert call(client, "post", "/teaching-assignments", "admin1", body).status_code == 409

    body["faculty_id"] = other_faculty.id
    res = call(client, "put", f"/teaching-assignments/{aid}", "admin1", body)
    assert res.json()["faculty"]["employee_id"] == "E002"
    assert call(client, "delete", f"/teaching-assignments/{aid}", "admin1").status_code == 204


def test_faculty_sees_only_own_assignments(
    client, faculty_user, other_faculty, assignment, subject2, section
):
    TeachingAssignment.objects.create(faculty=other_faculty, subject=subject2, section=section)
    own = call(client, "get", "/teaching-assignments", "fac1").json()
    assert own["count"] == 1 and own["items"][0]["id"] == assignment.id
    theirs = TeachingAssignment.objects.get(faculty=other_faculty)
    assert call(client, "get", f"/teaching-assignments/{theirs.id}", "fac1").status_code == 404


def test_faculty_and_student_cannot_write_assignments(client, faculty_user, student_user, subject, section):
    body = {"faculty_id": faculty_user.faculty_profile.id, "subject_id": subject.id, "section_id": section.id}
    assert call(client, "post", "/teaching-assignments", "fac1", body).status_code == 403
    assert call(client, "get", "/teaching-assignments", "stu1").status_code == 403


def test_faculty_my_classes(client, faculty_user, student_user, other_faculty, assignment, subject2, section):
    TeachingAssignment.objects.create(faculty=other_faculty, subject=subject2, section=section)
    res = call(client, "get", "/faculty/me/classes", "fac1")
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 1
    assert items[0]["assignment_id"] == assignment.id
    assert items[0]["subject"]["code"] == "CS301"
    assert items[0]["section"]["name"] == "A"
    assert call(client, "get", "/faculty/me/classes", "stu1").status_code == 403


def test_list_endpoints_do_not_n_plus_one(
    client, admin_user, faculty_user, subject, section, django_assert_max_num_queries
):
    for i in range(5):
        user = User.objects.create_user(f"s{i}", password=PASSWORD)
        sp = StudentProfile.objects.create(user=user, roll_no=f"X{i}", section=section, admission_year=2024)
        Enrollment.objects.create(student=sp, subject=subject)
    headers = auth_header(client, "admin1")
    with django_assert_max_num_queries(6):
        assert client.get("/api/v1/enrollments", **headers).json()["count"] == 5
