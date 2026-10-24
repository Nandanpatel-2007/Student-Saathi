import csv
import datetime as dt
import io
import json

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.academics.models import Enrollment, Section, Subject, TeachingAssignment
from apps.accounts.models import FacultyProfile, Role, StudentProfile, User
from apps.assessments.models import Assessment, Mark
from apps.attendance.models import AttendanceRecord, AttendanceSession

from .conftest import PASSWORD, auth_header, call

TODAY = timezone.localdate()


def make_student(username, roll_no, section, first=""):
    user = User.objects.create_user(username, password=PASSWORD, first_name=first or username)
    return StudentProfile.objects.create(user=user, roll_no=roll_no, section=section, admission_year=2024)


def add_sessions(assignment, owner, statuses_by_student, start=TODAY - dt.timedelta(days=30)):
    """statuses_by_student: {StudentProfile: ["PRESENT", ...]} - one status per session."""
    n = len(next(iter(statuses_by_student.values())))
    sessions = [
        AttendanceSession.objects.create(
            teaching_assignment=assignment, date=start + dt.timedelta(days=i), period=1, created_by=owner
        )
        for i in range(n)
    ]
    for student, statuses in statuses_by_student.items():
        for session, status in zip(sessions, statuses, strict=True):
            AttendanceRecord.objects.create(session=session, student=student, status=status)
    return sessions


def add_assessment(assignment, marks_by_student, title="Mid", max_marks=100, weight=100, day=0):
    assessment = Assessment.objects.create(
        teaching_assignment=assignment,
        title=title,
        type="MIDTERM",
        max_marks=max_marks,
        weightage_percent=weight,
        date=TODAY - dt.timedelta(days=20 - day),
    )
    for student, marks in marks_by_student.items():
        Mark.objects.create(
            assessment=assessment,
            student=student,
            marks_obtained=None if marks == "AB" else marks,
            is_absent=marks == "AB",
        )
    return assessment


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
def klass(student_user, section, subject, assignment, faculty_user):
    """stu1: 100% / 90 marks. stu2: 75% / 60 marks. stu3: 25% / 30 marks."""
    s1 = student_user.student_profile
    s2 = make_student("stu2", "R002", section)
    s3 = make_student("stu3", "R003", section)
    for s in (s1, s2, s3):
        Enrollment.objects.create(student=s, subject=subject)
    P, A = "PRESENT", "ABSENT"
    add_sessions(
        assignment,
        faculty_user,
        {s1: [P, P, P, P], s2: [P, P, P, A], s3: [P, A, A, A]},
    )
    add_assessment(assignment, {s1: 90, s2: 60, s3: 30})
    return {"s1": s1, "s2": s2, "s3": s3, "assignment": assignment}


# ------------------------------------------------------------------ student dashboard


def test_student_dashboard_values(client, klass):
    res = call(client, "get", "/students/me/dashboard", "stu1")
    assert res.status_code == 200
    body = res.json()
    assert body["attendance_overall"] == 100
    [subj] = body["subjects"]
    assert subj["subject"]["code"] == "CS301"
    assert subj["attendance_pct"] == 100 and subj["classes_held"] == 4
    assert subj["weighted_score"] == 90 and subj["class_avg"] == 60
    assert subj["percentile"] == pytest.approx(83.33)
    assert subj["alerts"] == [] and body["alerts"] == []
    assert body["trend"][-1]["attendance_pct"] == 100


def test_student_dashboard_alerts_and_classes_needed(client, klass):
    body = call(client, "get", "/students/me/dashboard", "stu3").json()
    [subj] = body["subjects"]
    assert subj["attendance_pct"] == 25
    assert subj["classes_needed_for_threshold"] == 8  # (1+n)/(4+n) >= .75 -> n >= 8
    assert {a["code"] for a in body["alerts"]} == {"LOW_ATTENDANCE", "FAILING_SUBJECT"}
    assert all(a["subject_code"] == "CS301" for a in body["alerts"])


def test_student_dashboard_warning_band(client, klass):
    body = call(client, "get", "/students/me/dashboard", "stu2").json()
    assert [a["code"] for a in body["alerts"]] == ["ATTENDANCE_WARNING"]


def test_dashboard_never_leaks_other_students(client, klass):
    res = call(client, "get", "/students/me/dashboard", "stu1")
    text = res.content.decode()
    for leaked in ("R002", "R003", "stu2", "stu3"):
        assert leaked not in text


def test_dashboard_access_control(client, klass, faculty_user, admin_user):
    assert call(client, "get", "/students/me/dashboard").status_code == 401
    assert call(client, "get", "/students/me/dashboard", "fac1").status_code == 403
    assert call(client, "get", "/students/me/dashboard", "admin1").status_code == 403


def test_dashboard_for_student_with_no_data(client, student_user, subject):
    Enrollment.objects.create(student=student_user.student_profile, subject=subject)
    body = call(client, "get", "/students/me/dashboard", "stu1").json()
    assert body["attendance_overall"] is None and body["trend"] == []
    [subj] = body["subjects"]
    assert subj["attendance_pct"] is None and subj["weighted_score"] is None and subj["class_avg"] is None


def test_dashboard_without_student_profile_is_404(client, db):
    User.objects.create_user("ghost", password=PASSWORD, role=Role.STUDENT)
    assert call(client, "get", "/students/me/dashboard", "ghost").status_code == 404


def test_dashboard_absent_in_assessment_counts_as_zero(client, klass, assignment, student_user):
    add_assessment(assignment, {klass["s1"]: "AB", klass["s2"]: 50}, title="Quiz", weight=0, day=5)
    # weight 0 -> contributes nothing; score unchanged
    assert call(client, "get", "/students/me/dashboard", "stu1").json()["subjects"][0]["weighted_score"] == 90


# ------------------------------------------------------------------ faculty summary / students


def test_class_summary(client, klass, assignment):
    res = call(client, "get", f"/faculty/classes/{assignment.id}/summary", "fac1")
    assert res.status_code == 200
    body = res.json()
    assert body["students"] == 3 and body["sessions_held"] == 4
    assert body["attendance_pct"] == pytest.approx(66.67)
    assert body["average_score"] == 60
    dist = {b["label"]: b["count"] for b in body["marks_distribution"]}
    assert dist["30-40"] == 1 and dist["60-70"] == 1 and dist["90-100"] == 1
    assert sum(dist.values()) == 3
    [risk] = body["at_risk_students"]
    assert risk["student"]["roll_no"] == "R003"
    assert {a["code"] for a in risk["alerts"]} == {"LOW_ATTENDANCE", "FAILING_SUBJECT"}


def test_class_students_list(client, klass, assignment):
    res = call(client, "get", f"/faculty/classes/{assignment.id}/students", "fac1")
    assert res.status_code == 200
    page = res.json()
    assert page["count"] == 3
    rows = {r["student"]["roll_no"]: r for r in page["items"]}
    assert rows["R001"]["rank"] == 1 and rows["R001"]["attendance_pct"] == 100
    assert rows["R002"]["attendance_pct"] == 75 and rows["R002"]["weighted_score"] == 60
    assert rows["R003"]["rank"] == 3 and rows["R003"]["absent"] == 3

    small = call(client, "get", f"/faculty/classes/{assignment.id}/students?page_size=2", "fac1").json()
    assert len(small["items"]) == 2 and small["total_pages"] == 2


def test_class_endpoints_scoping(client, klass, assignment, other_faculty, admin_user):
    for suffix in ("summary", "students", "export?type=marks"):
        path = f"/faculty/classes/{assignment.id}/{suffix}"
        assert call(client, "get", path, "fac1").status_code == 200
        assert call(client, "get", path, "admin1").status_code == 200
        assert call(client, "get", path, "fac2").status_code == 404
        assert call(client, "get", path, "stu1").status_code == 403
        assert call(client, "get", path).status_code == 401
    assert call(client, "get", "/faculty/classes/999/summary", "fac1").status_code == 404


def test_empty_class_summary(client, assignment):
    body = call(client, "get", f"/faculty/classes/{assignment.id}/summary", "fac1").json()
    assert body["students"] == 0 and body["attendance_pct"] is None and body["average_score"] is None
    assert body["at_risk_students"] == [] and sum(b["count"] for b in body["marks_distribution"]) == 0


# ------------------------------------------------------------------ CSV export


def test_attendance_csv_export(client, klass, assignment):
    res = call(client, "get", f"/faculty/classes/{assignment.id}/export?type=attendance", "fac1")
    assert res.status_code == 200
    assert res["Content-Type"].startswith("text/csv")
    assert 'filename="CS301-A-attendance.csv"' in res["Content-Disposition"]
    lines = res.content.decode().strip().splitlines()
    assert lines[0].startswith("Roll No,Name,") and lines[0].endswith(
        "Present,Late,Absent,Excused,Attendance %"
    )
    assert len(lines) == 4
    assert lines[3].split(",")[2:6] == ["P", "A", "A", "A"]  # R003
    assert lines[3].endswith(",1,0,3,0,25.0")


def test_marks_csv_export(client, klass, assignment):
    add_assessment(assignment, {klass["s1"]: "AB"}, title="Quiz", max_marks=20, weight=0, day=3)
    text = call(client, "get", f"/faculty/classes/{assignment.id}/export?type=marks", "fac1").content.decode()
    rows = list(csv.reader(io.StringIO(text)))
    assert rows[0] == ["Roll No", "Name", "Mid (/100, 100%)", "Quiz (/20, 0%)", "Weighted score %"]
    assert rows[1][2:4] == ["90", "AB"]
    assert rows[2][3] == ""  # pending


def test_csv_export_neutralises_formula_injection(client, klass, assignment):
    klass["s2"].user.first_name = "=HYPERLINK(1)"
    klass["s2"].user.save()
    text = call(client, "get", f"/faculty/classes/{assignment.id}/export?type=marks", "fac1").content.decode()
    assert "'=HYPERLINK(1)" in text and ",=HYPERLINK" not in text


def test_csv_export_requires_valid_type(client, klass, assignment):
    assert call(client, "get", f"/faculty/classes/{assignment.id}/export?type=pdf", "fac1").status_code == 422
    assert call(client, "get", f"/faculty/classes/{assignment.id}/export", "fac1").status_code == 422


# ------------------------------------------------------------------ configurable rules


def test_excused_policy_setting_changes_dashboard(client, klass, assignment, faculty_user, settings):
    # stu1 gets 4 excused sessions on top of 4 present
    add_sessions(
        assignment, faculty_user, {klass["s1"]: ["EXCUSED"] * 4}, start=TODAY - dt.timedelta(days=100)
    )
    assert call(client, "get", "/students/me/dashboard", "stu1").json()["attendance_overall"] == 100
    settings.ATTENDANCE_EXCUSED_POLICY = "ABSENT"
    assert call(client, "get", "/students/me/dashboard", "stu1").json()["attendance_overall"] == 50


def test_threshold_setting_changes_alerts(client, klass, settings):
    settings.ATTENDANCE_THRESHOLD_PERCENT = 20
    settings.ATTENDANCE_WARNING_UPPER_PERCENT = 20
    codes = {a["code"] for a in call(client, "get", "/students/me/dashboard", "stu3").json()["alerts"]}
    assert codes == {"FAILING_SUBJECT"}


# ------------------------------------------------------------------ N+1 guards


def count_queries(client, path, user):
    headers = auth_header(client, user)
    with CaptureQueriesContext(connection) as ctx:
        assert client.get(f"/api/v1{path}", **headers).status_code == 200
    return len(ctx)


def add_subject_class(i, faculty_profile, section, students, owner):
    subject = Subject.objects.create(code=f"X{i}", name=f"Extra {i}", credits=2, semester=3)
    assignment = TeachingAssignment.objects.create(faculty=faculty_profile, subject=subject, section=section)
    for s in students:
        Enrollment.objects.create(student=s, subject=subject)
    add_sessions(assignment, owner, {s: ["PRESENT", "ABSENT", "LATE"] for s in students})
    add_assessment(assignment, {s: 40 + 5 * n for n, s in enumerate(students)}, title="A", weight=50)
    add_assessment(assignment, {s: 60 + 3 * n for n, s in enumerate(students)}, title="B", weight=50, day=5)
    return assignment


def test_student_dashboard_query_count_is_constant(client, klass, faculty_user, section):
    students = [klass["s1"], klass["s2"], klass["s3"]]
    baseline = count_queries(client, "/students/me/dashboard", "stu1")
    for i in range(4):
        add_subject_class(i, faculty_user.faculty_profile, section, students, faculty_user)
    assert Subject.objects.count() == 5
    assert count_queries(client, "/students/me/dashboard", "stu1") == baseline
    assert baseline <= 12


def test_class_endpoints_query_count_is_constant(client, klass, assignment, student_user, section):
    paths = [
        f"/faculty/classes/{assignment.id}/summary",
        f"/faculty/classes/{assignment.id}/students",
        f"/faculty/classes/{assignment.id}/export?type=attendance",
        f"/faculty/classes/{assignment.id}/export?type=marks",
    ]
    baseline = [count_queries(client, p, "fac1") for p in paths]
    for n in range(4, 20):
        s = make_student(f"extra{n}", f"R{n:03d}", section)
        Enrollment.objects.create(student=s, subject=assignment.subject)
        for session in AttendanceSession.objects.filter(teaching_assignment=assignment):
            AttendanceRecord.objects.create(session=session, student=s, status="PRESENT")
        for assessment in Assessment.objects.filter(teaching_assignment=assignment):
            Mark.objects.create(assessment=assessment, student=s, marks_obtained=50)
    assert [count_queries(client, p, "fac1") for p in paths] == baseline
    assert max(baseline) <= 12


def test_json_is_serialisable_with_plain_numbers(client, klass):
    text = call(client, "get", "/students/me/dashboard", "stu1").content.decode()
    body = json.loads(text)
    assert isinstance(body["subjects"][0]["weighted_score"], (int, float))
    assert Section.objects.count() == 1
