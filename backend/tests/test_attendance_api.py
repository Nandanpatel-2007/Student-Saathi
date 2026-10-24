import datetime as dt
import json

import pytest
from django.utils import timezone

from apps.academics.models import Enrollment, Section, Subject, TeachingAssignment
from apps.accounts.models import FacultyProfile, Role, StudentProfile, User
from apps.attendance.models import AttendanceAuditLog, AttendanceRecord, AttendanceSession

from .conftest import PASSWORD, auth_header

TODAY = timezone.localdate()


def call(client, method, path, user=None, body=None):
    kwargs = auth_header(client, user) if user else {}
    if body is not None:
        kwargs.update(data=json.dumps(body), content_type="application/json")
    return getattr(client, method)(f"/api/v1{path}", **kwargs)


def make_student(username, roll_no, section):
    user = User.objects.create_user(username, password=PASSWORD, first_name=username.upper())
    return StudentProfile.objects.create(user=user, roll_no=roll_no, section=section, admission_year=2024)


@pytest.fixture
def subject(db):
    return Subject.objects.create(code="CS301", name="Algorithms", credits=4, semester=3)


@pytest.fixture
def assignment(faculty_user, subject, section):
    return TeachingAssignment.objects.create(
        faculty=faculty_user.faculty_profile, subject=subject, section=section
    )


@pytest.fixture
def roster(student_user, section, subject):
    """stu1 + two more in the section, all enrolled; one section member NOT enrolled; one enrolled but in
    another section."""
    s1 = student_user.student_profile
    s2 = make_student("stu2", "R002", section)
    s3 = make_student("stu3", "R003", section)
    not_enrolled = make_student("stu4", "R004", section)
    other_section = Section.objects.create(name="B", program="B.Tech", semester=3, academic_year="2025-2026")
    elsewhere = make_student("stu5", "R005", other_section)
    for s in (s1, s2, s3, elsewhere):
        Enrollment.objects.create(student=s, subject=subject)
    return {"s1": s1, "s2": s2, "s3": s3, "not_enrolled": not_enrolled, "elsewhere": elsewhere}


@pytest.fixture
def other_faculty(db, department):
    user = User.objects.create_user("fac2", password=PASSWORD, role=Role.FACULTY)
    return FacultyProfile.objects.create(user=user, employee_id="E002", department=department)


def new_session(client, assignment, user="fac1", date=None, period=1, topic=""):
    return call(
        client,
        "post",
        "/attendance/sessions",
        user,
        {
            "teaching_assignment_id": assignment.id,
            "date": str(date or TODAY),
            "period": period,
            "topic": topic,
        },
    )


# ------------------------------------------------------------------ create


def test_create_session_prefills_enrolled_section_students_as_present(client, assignment, roster):
    res = new_session(client, assignment, topic="Sorting")
    assert res.status_code == 201
    body = res.json()
    assert body["topic"] == "Sorting"
    assert body["subject"]["code"] == "CS301"
    assert body["total"] == 3 and body["present"] == 3
    assert [r["student"]["roll_no"] for r in body["records"]] == ["R001", "R002", "R003"]
    assert {r["status"] for r in body["records"]} == {"PRESENT"}
    assert AttendanceRecord.objects.count() == 3


def test_admin_can_create_session(client, admin_user, assignment, roster):
    assert new_session(client, assignment, user="admin1").status_code == 201


def test_create_duplicate_session_conflicts_and_leaves_no_partial_rows(client, assignment, roster):
    assert new_session(client, assignment).status_code == 201
    assert new_session(client, assignment).status_code == 409
    assert AttendanceSession.objects.count() == 1
    assert AttendanceRecord.objects.count() == 3
    assert new_session(client, assignment, period=2).status_code == 201


def test_future_date_rejected(client, assignment, roster):
    res = new_session(client, assignment, date=TODAY + dt.timedelta(days=1))
    assert res.status_code == 422
    assert AttendanceSession.objects.count() == 0


def test_invalid_period_rejected(client, assignment):
    assert new_session(client, assignment, period=0).status_code == 422


def test_other_faculty_and_student_cannot_create(client, assignment, other_faculty, student_user):
    assert new_session(client, assignment, user="fac2").status_code == 403
    assert new_session(client, assignment, user="stu1").status_code == 403
    assert AttendanceSession.objects.count() == 0


def test_create_for_unknown_assignment_404(client, faculty_user):
    res = call(
        client,
        "post",
        "/attendance/sessions",
        "fac1",
        {"teaching_assignment_id": 999, "date": str(TODAY), "period": 1},
    )
    assert res.status_code == 404


# ------------------------------------------------------------------ update records


def test_bulk_update_records_with_audit_trail(client, assignment, roster, faculty_user):
    session_id = new_session(client, assignment).json()["id"]
    body = {
        "records": [
            {"student_id": roster["s1"].id, "status": "ABSENT"},
            {"student_id": roster["s2"].id, "status": "LATE"},
            {"student_id": roster["s3"].id, "status": "PRESENT"},  # unchanged
        ]
    }
    res = call(client, "put", f"/attendance/sessions/{session_id}/records", "fac1", body)
    assert res.status_code == 200
    data = res.json()
    assert (data["present"], data["absent"], data["late"], data["excused"]) == (1, 1, 1, 0)
    assert data["updated_by_name"] == "Fay Culty"

    by_roll = {r["student"]["roll_no"]: r for r in data["records"]}
    assert by_roll["R001"]["status"] == "ABSENT" and by_roll["R001"]["updated_by_name"] == "Fay Culty"

    logs = AttendanceAuditLog.objects.order_by("student__roll_no")
    assert [(entry.old_status, entry.new_status, entry.changed_by) for entry in logs] == [
        ("PRESENT", "ABSENT", faculty_user),
        ("PRESENT", "LATE", faculty_user),
    ]

    # Editing again appends to the trail rather than overwriting it.
    body = {"records": [{"student_id": roster["s1"].id, "status": "EXCUSED"}]}
    call(client, "put", f"/attendance/sessions/{session_id}/records", "fac1", body)
    assert AttendanceAuditLog.objects.filter(student=roster["s1"]).count() == 2


def test_update_with_no_changes_writes_no_audit(client, assignment, roster):
    session_id = new_session(client, assignment).json()["id"]
    body = {"records": [{"student_id": roster["s1"].id, "status": "PRESENT"}]}
    assert call(client, "put", f"/attendance/sessions/{session_id}/records", "fac1", body).status_code == 200
    assert AttendanceAuditLog.objects.count() == 0


def test_update_rejects_unknown_duplicate_and_bad_status(client, assignment, roster):
    session_id = new_session(client, assignment).json()["id"]
    url = f"/attendance/sessions/{session_id}/records"

    unknown = {"records": [{"student_id": roster["not_enrolled"].id, "status": "ABSENT"}]}
    assert call(client, "put", url, "fac1", unknown).status_code == 422

    dup = {"records": [{"student_id": roster["s1"].id, "status": "ABSENT"}] * 2}
    assert call(client, "put", url, "fac1", dup).status_code == 422

    bad = {"records": [{"student_id": roster["s1"].id, "status": "SLEEPING"}]}
    assert call(client, "put", url, "fac1", bad).status_code == 422

    assert call(client, "put", url, "fac1", {"records": []}).status_code == 422
    assert AttendanceAuditLog.objects.count() == 0


def test_one_bad_row_rolls_back_whole_update(client, assignment, roster):
    session_id = new_session(client, assignment).json()["id"]
    body = {
        "records": [
            {"student_id": roster["s1"].id, "status": "ABSENT"},
            {"student_id": roster["not_enrolled"].id, "status": "ABSENT"},
        ]
    }
    assert call(client, "put", f"/attendance/sessions/{session_id}/records", "fac1", body).status_code == 422
    assert AttendanceRecord.objects.get(student=roster["s1"]).status == "PRESENT"


def test_other_faculty_cannot_edit_but_admin_can(client, assignment, roster, other_faculty, admin_user):
    session_id = new_session(client, assignment).json()["id"]
    url = f"/attendance/sessions/{session_id}/records"
    body = {"records": [{"student_id": roster["s1"].id, "status": "ABSENT"}]}

    assert call(client, "put", url, "fac2", body).status_code == 403
    assert call(client, "put", url, "stu1", body).status_code == 403
    assert AttendanceAuditLog.objects.count() == 0

    assert call(client, "put", url, "admin1", body).status_code == 200
    assert AttendanceAuditLog.objects.get().changed_by == admin_user


def test_update_unknown_session_404(client, faculty_user):
    body = {"records": [{"student_id": 1, "status": "ABSENT"}]}
    assert call(client, "put", "/attendance/sessions/999/records", "fac1", body).status_code == 404


# ------------------------------------------------------------------ reads


def test_list_filters_and_scoping(client, assignment, roster, other_faculty, subject, section, admin_user):
    other_subject = Subject.objects.create(code="CS302", name="Databases", credits=3, semester=3)
    other_assignment = TeachingAssignment.objects.create(
        faculty=other_faculty, subject=other_subject, section=section
    )
    old = TODAY - dt.timedelta(days=10)
    new_session(client, assignment, date=old)
    new_session(client, assignment, date=TODAY)
    assert new_session(client, other_assignment, user="fac2").status_code == 201

    mine = call(client, "get", "/attendance/sessions", "fac1").json()
    assert mine["count"] == 2
    assert mine["items"][0]["date"] == str(TODAY)  # newest first
    assert mine["items"][0]["total"] == 3

    assert call(client, "get", "/attendance/sessions", "admin1").json()["count"] == 3

    q = f"?subject={subject.id}&section={section.id}&date_from={old}&date_to={old}"
    filtered = call(client, "get", f"/attendance/sessions{q}", "admin1").json()
    assert filtered["count"] == 1 and filtered["items"][0]["date"] == str(old)

    assert (
        call(client, "get", f"/attendance/sessions?subject={other_subject.id}", "fac1").json()["count"] == 0
    )
    assert call(client, "get", "/attendance/sessions", "stu1").status_code == 403


def test_detail_scoping(client, assignment, roster, other_faculty, admin_user):
    session_id = new_session(client, assignment).json()["id"]
    path = f"/attendance/sessions/{session_id}"
    assert call(client, "get", path, "fac1").status_code == 200
    assert call(client, "get", path, "admin1").status_code == 200
    assert call(client, "get", path, "fac2").status_code == 404
    assert call(client, "get", path, "stu1").status_code == 403
    assert call(client, "get", "/attendance/sessions/999", "fac1").status_code == 404


def test_session_reads_do_not_n_plus_one(client, assignment, roster, django_assert_max_num_queries):
    for period in range(1, 6):
        new_session(client, assignment, period=period)
    headers = auth_header(client, "fac1")
    with django_assert_max_num_queries(6):
        assert client.get("/api/v1/attendance/sessions", **headers).json()["count"] == 5
    session_id = AttendanceSession.objects.first().id
    with django_assert_max_num_queries(7):
        assert client.get(f"/api/v1/attendance/sessions/{session_id}", **headers).status_code == 200
