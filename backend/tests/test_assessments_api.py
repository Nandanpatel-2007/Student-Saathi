import datetime as dt
import json

import pytest

from apps.academics.models import Enrollment, Section, Subject, TeachingAssignment
from apps.accounts.models import FacultyProfile, Role, StudentProfile, User
from apps.assessments.models import Assessment, Mark

from .conftest import PASSWORD, auth_header


def call(client, method, path, user=None, body=None):
    kwargs = auth_header(client, user) if user else {}
    if body is not None:
        kwargs.update(data=json.dumps(body), content_type="application/json")
    return getattr(client, method)(f"/api/v1{path}", **kwargs)


def make_student(username, roll_no, section):
    user = User.objects.create_user(username, password=PASSWORD)
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
def other_faculty(db, department):
    user = User.objects.create_user("fac2", password=PASSWORD, role=Role.FACULTY)
    return FacultyProfile.objects.create(user=user, employee_id="E002", department=department)


@pytest.fixture
def roster(student_user, section, subject):
    s1 = student_user.student_profile
    s2 = make_student("stu2", "R002", section)
    not_enrolled = make_student("stu3", "R003", section)
    Enrollment.objects.create(student=s1, subject=subject)
    Enrollment.objects.create(student=s2, subject=subject)
    return {"s1": s1, "s2": s2, "not_enrolled": not_enrolled}


def payload(assignment, **overrides):
    body = {
        "teaching_assignment_id": assignment.id,
        "title": "Quiz 1",
        "type": "QUIZ",
        "max_marks": 20,
        "date": "2025-09-01",
    }
    body.update(overrides)
    return body


def make_assessment(assignment, **kw):
    defaults = dict(title="Quiz", type="QUIZ", max_marks=20, date=dt.date(2025, 9, 1))
    defaults.update(kw)
    return Assessment.objects.create(teaching_assignment=assignment, **defaults)


# ------------------------------------------------------------------ assessment CRUD


def test_faculty_assessment_crud(client, assignment):
    res = call(client, "post", "/assessments", "fac1", payload(assignment))
    assert res.status_code == 201
    body = res.json()
    assert body["max_marks"] == 20  # JSON numbers, not strings
    assert "weightage_percent" not in body
    assert body["subject"]["code"] == "CS301" and body["type"] == "QUIZ"
    aid = body["id"]

    update = {
        k: v
        for k, v in payload(assignment, title="Quiz One", max_marks=25).items()
        if k != "teaching_assignment_id"
    }
    res = call(client, "put", f"/assessments/{aid}", "fac1", update)
    assert res.status_code == 200 and res.json()["title"] == "Quiz One"

    assert call(client, "get", f"/assessments/{aid}", "fac1").json()["max_marks"] == 25
    assert call(client, "delete", f"/assessments/{aid}", "fac1").status_code == 204
    assert call(client, "get", f"/assessments/{aid}", "fac1").status_code == 404


def test_assessment_validation(client, assignment):
    for bad in ({"max_marks": 0}, {"max_marks": -5}, {"type": "EXAM"}, {"title": ""}):
        assert call(client, "post", "/assessments", "fac1", payload(assignment, **bad)).status_code == 422


def test_any_number_of_assessments_is_allowed_and_weightage_is_gone(client, assignment):
    # There is no 100% budget any more: every graded item simply counts equally.
    for i in range(12):
        res = call(client, "post", "/assessments", "fac1", payload(assignment, title=f"Quiz {i}"))
        assert res.status_code == 201
        assert "weightage_percent" not in res.json()
    # A leftover weightage field from an old client is ignored, not stored or validated.
    res = call(client, "post", "/assessments", "fac1", payload(assignment, weightage_percent=900))
    assert res.status_code == 201 and "weightage_percent" not in res.json()
    assert not hasattr(Assessment.objects.first(), "weightage_percent")


def test_cannot_lower_max_marks_below_recorded_marks(client, assignment, roster):
    assessment = make_assessment(assignment, max_marks=20)
    Mark.objects.create(assessment=assessment, student=roster["s1"], marks_obtained=18)
    upd = {k: v for k, v in payload(assignment, max_marks=15).items() if k != "teaching_assignment_id"}
    assert call(client, "put", f"/assessments/{assessment.id}", "fac1", upd).status_code == 422


def test_write_permissions(client, assignment, other_faculty, student_user, admin_user):
    assert call(client, "post", "/assessments", "fac2", payload(assignment)).status_code == 403
    assert call(client, "post", "/assessments", "stu1", payload(assignment)).status_code == 403
    assert call(client, "post", "/assessments", None, payload(assignment)).status_code == 401
    assert call(client, "post", "/assessments", "admin1", payload(assignment)).status_code == 201
    assert (
        call(
            client, "post", "/assessments", "fac1", payload(assignment, teaching_assignment_id=999)
        ).status_code
        == 404
    )

    aid = Assessment.objects.get().id
    upd = {k: v for k, v in payload(assignment).items() if k != "teaching_assignment_id"}
    assert call(client, "put", f"/assessments/{aid}", "fac2", upd).status_code == 403
    assert call(client, "delete", f"/assessments/{aid}", "fac2").status_code == 403
    assert call(client, "delete", f"/assessments/{aid}", "stu1").status_code == 403
    assert Assessment.objects.count() == 1


def test_list_scoping_and_filters(client, assignment, roster, other_faculty, subject, section, admin_user):
    other_subject = Subject.objects.create(code="CS302", name="DB", credits=3, semester=3)
    other_assignment = TeachingAssignment.objects.create(
        faculty=other_faculty, subject=other_subject, section=section
    )
    make_assessment(assignment, title="Mine Quiz", date=dt.date(2025, 9, 1))
    make_assessment(assignment, title="Mine Mid", type="MIDTERM", date=dt.date(2025, 10, 1))
    make_assessment(other_assignment, title="Theirs")

    assert call(client, "get", "/assessments", "admin1").json()["count"] == 3
    mine = call(client, "get", "/assessments", "fac1").json()
    assert [a["title"] for a in mine["items"]] == ["Mine Quiz", "Mine Mid"]
    # stu1 is enrolled only in CS301.
    assert call(client, "get", "/assessments", "stu1").json()["count"] == 2

    assert call(client, "get", "/assessments?type=MIDTERM", "fac1").json()["count"] == 1
    assert call(client, "get", "/assessments?date_from=2025-09-15", "fac1").json()["count"] == 1
    assert call(client, "get", f"/assessments?subject={other_subject.id}", "admin1").json()["count"] == 1

    theirs = Assessment.objects.get(title="Theirs")
    assert call(client, "get", f"/assessments/{theirs.id}", "fac1").status_code == 404
    assert call(client, "get", f"/assessments/{theirs.id}", "stu1").status_code == 404


# ------------------------------------------------------------------ marks


def test_marks_sheet_lists_roster_with_blanks(client, assignment, roster):
    assessment = make_assessment(assignment)
    res = call(client, "get", f"/assessments/{assessment.id}/marks", "fac1")
    assert res.status_code == 200
    rows = res.json()["marks"]
    assert [r["student"]["roll_no"] for r in rows] == ["R001", "R002"]  # not_enrolled excluded
    assert all(r["marks_obtained"] is None and r["is_absent"] is False for r in rows)


def test_bulk_marks_upsert(client, assignment, roster):
    assessment = make_assessment(assignment, max_marks=20)
    url = f"/assessments/{assessment.id}/marks"
    body = {
        "marks": [
            {"student_id": roster["s1"].id, "marks_obtained": 17.5},
            {"student_id": roster["s2"].id, "is_absent": True},
        ]
    }
    res = call(client, "put", url, "fac1", body)
    assert res.status_code == 200
    rows = {r["student"]["roll_no"]: r for r in res.json()["marks"]}
    assert rows["R001"]["marks_obtained"] == 17.5 and rows["R002"]["is_absent"] is True
    assert Mark.objects.count() == 2

    # Update in place: absent student turns up, s1 corrected.
    body = {
        "marks": [
            {"student_id": roster["s1"].id, "marks_obtained": 20},
            {"student_id": roster["s2"].id, "marks_obtained": 12, "is_absent": False},
        ]
    }
    call(client, "put", url, "fac1", body)
    assert Mark.objects.count() == 2
    assert Mark.objects.get(student=roster["s2"]).marks_obtained == 12
    assert Mark.objects.get(student=roster["s2"]).is_absent is False
    assert Mark.objects.get(student=roster["s1"]).marks_obtained == 20


def test_marks_validation_is_all_or_nothing_with_details(client, assignment, roster):
    assessment = make_assessment(assignment, max_marks=20)
    body = {
        "marks": [
            {"student_id": roster["s1"].id, "marks_obtained": 10},
            {"student_id": roster["s2"].id, "marks_obtained": 21},
            {"student_id": roster["not_enrolled"].id, "marks_obtained": 5},
            {"student_id": roster["s1"].id, "marks_obtained": 5},
            {"student_id": roster["s2"].id, "marks_obtained": 3, "is_absent": True},
        ]
    }
    res = call(client, "put", f"/assessments/{assessment.id}/marks", "fac1", body)
    assert res.status_code == 422
    fields = {d["field"] for d in res.json()["error"]["details"]}
    assert {
        "marks.1.marks_obtained",
        "marks.2.student_id",
        "marks.3.student_id",
        "marks.4.marks_obtained",
    } <= fields
    assert Mark.objects.count() == 0


def test_marks_equal_to_max_allowed_and_negative_rejected(client, assignment, roster):
    assessment = make_assessment(assignment, max_marks=20)
    url = f"/assessments/{assessment.id}/marks"
    ok = {"marks": [{"student_id": roster["s1"].id, "marks_obtained": 20}]}
    assert call(client, "put", url, "fac1", ok).status_code == 200
    neg = {"marks": [{"student_id": roster["s1"].id, "marks_obtained": -1}]}
    assert call(client, "put", url, "fac1", neg).status_code == 422


def test_marks_write_permissions(client, assignment, roster, other_faculty, admin_user):
    assessment = make_assessment(assignment)
    url = f"/assessments/{assessment.id}/marks"
    body = {"marks": [{"student_id": roster["s1"].id, "marks_obtained": 5}]}
    assert call(client, "put", url, "fac2", body).status_code == 403
    assert call(client, "put", url, "stu1", body).status_code == 403
    assert Mark.objects.count() == 0
    assert call(client, "put", url, "admin1", body).status_code == 200
    assert call(client, "put", "/assessments/999/marks", "fac1", body).status_code == 404


def test_student_sees_only_own_marks(client, assignment, roster, other_faculty):
    assessment = make_assessment(assignment)
    Mark.objects.create(assessment=assessment, student=roster["s1"], marks_obtained=15)
    Mark.objects.create(assessment=assessment, student=roster["s2"], marks_obtained=9)

    res = call(client, "get", f"/assessments/{assessment.id}/marks", "stu1")
    assert res.status_code == 200
    rows = res.json()["marks"]
    assert len(rows) == 1 and rows[0]["student"]["roll_no"] == "R001" and rows[0]["marks_obtained"] == 15
    assert "R002" not in json.dumps(res.json())

    # A student outside the class cannot see the sheet at all.
    outsider = make_student(
        "stu9",
        "R009",
        Section.objects.create(name="Z", program="B.Tech", semester=3, academic_year="2025-2026"),
    )
    assert call(client, "get", f"/assessments/{assessment.id}/marks", "stu9").status_code == 404
    assert outsider.id


def test_assessment_reads_do_not_n_plus_one(client, assignment, roster, django_assert_max_num_queries):
    for i in range(6):
        make_assessment(assignment, title=f"A{i}")
    headers = auth_header(client, "fac1")
    with django_assert_max_num_queries(6):
        assert client.get("/api/v1/assessments", **headers).json()["count"] == 6
