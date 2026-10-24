"""Cross-cutting authorization checks: who may not touch whose data."""

import pytest
from django.utils import timezone

from apps.academics.models import Enrollment, Subject, TeachingAssignment
from apps.accounts.models import FacultyProfile, Role, StudentProfile, User
from apps.assessments.models import Assessment, Mark
from apps.attendance.models import AttendanceRecord, AttendanceSession

from .conftest import PASSWORD, call

TODAY = timezone.localdate()


@pytest.fixture
def world(faculty_user, student_user, section, department):
    subject = Subject.objects.create(code="CS301", name="Algorithms", credits=4, semester=3)
    assignment = TeachingAssignment.objects.create(
        faculty=faculty_user.faculty_profile, subject=subject, section=section
    )
    mine = student_user.student_profile
    other_user = User.objects.create_user("stu2", password=PASSWORD, first_name="Other")
    other = StudentProfile.objects.create(
        user=other_user, roll_no="R002", section=section, admission_year=2024
    )
    fac2_user = User.objects.create_user("fac2", password=PASSWORD, role=Role.FACULTY)
    FacultyProfile.objects.create(user=fac2_user, employee_id="E002", department=department)
    for s in (mine, other):
        Enrollment.objects.create(student=s, subject=subject)
    session = AttendanceSession.objects.create(
        teaching_assignment=assignment, date=TODAY, period=1, created_by=faculty_user
    )
    for s in (mine, other):
        AttendanceRecord.objects.create(session=session, student=s, status="PRESENT")
    assessment = Assessment.objects.create(
        teaching_assignment=assignment, title="Q", type="QUIZ", max_marks=10, weightage_percent=10, date=TODAY
    )
    for s, m in ((mine, 9), (other, 4)):
        Mark.objects.create(assessment=assessment, student=s, marks_obtained=m)
    return {
        "assignment": assignment,
        "session": session,
        "assessment": assessment,
        "subject": subject,
        "mine": mine,
        "other": other,
        "enrollment_other": Enrollment.objects.get(student=other),
    }


def test_student_cannot_see_another_students_data(client, world):
    # Marks sheet: only own row, never the classmate's.
    sheet = call(client, "get", f"/assessments/{world['assessment'].id}/marks", "stu1").json()
    assert [r["student"]["roll_no"] for r in sheet["marks"]] == ["R001"]
    # Enrollments: classmate's is invisible.
    assert call(client, "get", f"/enrollments/{world['enrollment_other'].id}", "stu1").status_code == 404
    ids = [e["student"]["roll_no"] for e in call(client, "get", "/enrollments", "stu1").json()["items"]]
    assert ids == ["R001"]
    # Dashboard is strictly "me": the classmate's identity and score never appear.
    text = call(client, "get", "/students/me/dashboard", "stu1").content.decode()
    assert "R002" not in text and "Other" not in text
    # Attendance sessions (which list every classmate) are staff-only.
    assert call(client, "get", f"/attendance/sessions/{world['session'].id}", "stu1").status_code == 403


def test_student_percentile_reveals_only_own_standing(client, world):
    mine = call(client, "get", "/students/me/dashboard", "stu1").json()["subjects"][0]
    theirs = call(client, "get", "/students/me/dashboard", "stu2").json()["subjects"][0]
    assert mine["weighted_score"] == 90 and theirs["weighted_score"] == 40
    assert mine["percentile"] == 75 and theirs["percentile"] == 25
    assert set(mine) == set(theirs)  # no rank / classmate fields


@pytest.mark.parametrize(
    ("method", "template", "body"),
    [
        (
            "put",
            "/attendance/sessions/{session}/records",
            {"records": [{"student_id": "{mine}", "status": "ABSENT"}]},
        ),
        ("get", "/attendance/sessions/{session}", None),
        (
            "put",
            "/assessments/{assessment}/marks",
            {"marks": [{"student_id": "{mine}", "marks_obtained": 1}]},
        ),
        (
            "put",
            "/assessments/{assessment}",
            {"title": "x", "type": "QUIZ", "max_marks": 10, "weightage_percent": 5, "date": "2025-01-01"},
        ),
        ("delete", "/assessments/{assessment}", None),
        ("get", "/faculty/classes/{assignment}/summary", None),
        ("get", "/faculty/classes/{assignment}/students", None),
        ("get", "/faculty/classes/{assignment}/export?type=marks", None),
    ],
)
@pytest.mark.parametrize("actor", ["fac2", "stu1", "stu2"])
def test_outsiders_cannot_read_or_edit_a_class(client, world, method, template, body, actor):
    ids = {
        "session": world["session"].id,
        "assessment": world["assessment"].id,
        "assignment": world["assignment"].id,
        "mine": world["mine"].id,
    }
    path = template.format(**ids)
    if body is not None:
        body = _fill(body, ids)
    res = call(client, method, path, actor, body)
    assert res.status_code in (403, 404), res.content
    # ...and nothing changed.
    assert AttendanceRecord.objects.get(student=world["mine"]).status == "PRESENT"
    assert Mark.objects.get(student=world["mine"]).marks_obtained == 9
    assert Assessment.objects.filter(pk=ids["assessment"]).exists()


def _fill(value, ids):
    if isinstance(value, dict):
        return {k: _fill(v, ids) for k, v in value.items()}
    if isinstance(value, list):
        return [_fill(v, ids) for v in value]
    if isinstance(value, str) and value.startswith("{") and value.endswith("}"):
        return ids[value[1:-1]]
    return value


def test_other_faculty_cannot_create_in_a_class(client, world):
    assert (
        call(
            client,
            "post",
            "/attendance/sessions",
            "fac2",
            {"teaching_assignment_id": world["assignment"].id, "date": str(TODAY), "period": 2},
        ).status_code
        == 403
    )
    assert (
        call(
            client,
            "post",
            "/assessments",
            "fac2",
            {
                "teaching_assignment_id": world["assignment"].id,
                "title": "Sneaky",
                "type": "QUIZ",
                "max_marks": 10,
                "weightage_percent": 5,
                "date": str(TODAY),
            },
        ).status_code
        == 403
    )
    assert AttendanceSession.objects.count() == 1 and Assessment.objects.count() == 1


def test_student_cannot_use_admin_endpoints(client, world):
    for method, path, body in [
        ("post", "/subjects", {"code": "Z", "name": "Z", "credits": 1, "semester": 1}),
        ("post", "/enrollments/bulk", {"section_id": 1, "subject_id": world["subject"].id}),
        ("delete", f"/teaching-assignments/{world['assignment'].id}", None),
    ]:
        assert call(client, method, path, "stu1", body).status_code == 403
        assert call(client, method, path, "fac1", body).status_code == 403


def test_expired_style_garbage_tokens_never_authorize(client, world):
    res = client.get("/api/v1/students/me/dashboard", HTTP_AUTHORIZATION="Bearer not.a.token")
    assert res.status_code == 401
    assert "error" in res.json()
