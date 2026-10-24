import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone

from apps.academics.models import Department, Enrollment, Section, Subject, TeachingAssignment
from apps.accounts.models import FacultyProfile, Role, StudentProfile, User
from apps.assessments.models import Assessment, Mark
from apps.assignments import rules, uploads
from apps.assignments.models import Assignment, Submission
from apps.attendance.models import AttendanceRecord, AttendanceSession

from .conftest import login


@pytest.fixture
def seeded(db):
    call_command("seed_demo", verbosity=0)


def call(client, method, path, user):
    """GET as a demo user (demo accounts use the seed command's password)."""
    token = login(client, user, "demo1234").json()["access"]
    return getattr(client, method)(f"/api/v1{path}", HTTP_AUTHORIZATION=f"Bearer {token}")


def alert_codes(client, username):
    body = call(client, "get", "/students/me/dashboard", username).json()
    return {a["code"] for a in body["alerts"]}


def test_seed_demo_creates_requested_shape(seeded):
    assert User.objects.filter(role=Role.ADMIN).count() == 1
    assert FacultyProfile.objects.count() == 3
    assert Section.objects.count() == 2
    assert StudentProfile.objects.count() == 30
    assert Subject.objects.count() == 5
    assert TeachingAssignment.objects.count() == 10
    assert Enrollment.objects.count() == 150
    assert Assessment.objects.count() == 30  # 3 per class
    assert Mark.objects.count() == 450
    per_class = AttendanceSession.objects.filter(
        teaching_assignment=TeachingAssignment.objects.first()
    ).count()
    assert 15 <= per_class <= 20  # ~6 weeks, 3 sessions a week
    assert AttendanceRecord.objects.count() == AttendanceSession.objects.count() * 15
    assert not AttendanceSession.objects.filter(date__gt=timezone.localdate()).exists()


def test_seed_demo_refuses_to_run_twice_but_reset_replaces(seeded):
    with pytest.raises(CommandError):
        call_command("seed_demo", verbosity=0)
    call_command("seed_demo", "--reset", verbosity=0)
    assert StudentProfile.objects.count() == 30 and Subject.objects.count() == 5


def test_reset_leaves_other_data_alone(seeded):
    other = User.objects.create_user("realuser", password="x")
    keep = Subject.objects.create(code="REAL1", name="Keep me", credits=1, semester=1)
    call_command("seed_demo", "--reset", verbosity=0)
    assert User.objects.filter(pk=other.pk).exists() and Subject.objects.filter(pk=keep.pk).exists()


def test_demo_logins_work_and_at_risk_students_are_flagged(client, seeded):
    assert call(client, "get", "/auth/me", "admin").json()["role"] == "ADMIN"
    assert alert_codes(client, "student03") >= {"LOW_ATTENDANCE"}
    assert alert_codes(client, "student07") >= {"FAILING_SUBJECT"}
    assert alert_codes(client, "student12") >= {"SHARP_DROP"}
    assert alert_codes(client, "student18") >= {"ATTENDANCE_WARNING"}
    assert alert_codes(client, "student25") >= {"LOW_ATTENDANCE", "FAILING_SUBJECT"}
    assert "LOW_ATTENDANCE" not in alert_codes(client, "student01")


def test_faculty_sees_at_risk_students_in_demo_class(client, seeded):
    classes = call(client, "get", "/faculty/me/classes", "faculty1").json()["items"]
    assert len(classes) == 4
    section_a = next(c for c in classes if c["subject"]["code"] == "DM-CS301" and c["section"]["name"] == "A")
    summary = call(client, "get", f"/faculty/classes/{section_a['assignment_id']}/summary", "faculty1").json()
    at_risk = {r["student"]["roll_no"] for r in summary["at_risk_students"]}
    assert {"CSEA003", "CSEA007", "CSEA012"} <= at_risk
    assert summary["students"] == 15 and sum(b["count"] for b in summary["marks_distribution"]) == 15


# ------------------------------------------------------------------ assignments in the demo data


def test_seed_demo_creates_assignments_with_a_realistic_mix(seeded):

    assert Assignment.objects.count() == 30  # 3 per class, 10 classes
    assert Assignment.objects.filter(due_at__gt=timezone.now()).count() == 10  # one upcoming per class
    assert Assignment.objects.filter(allow_late_submissions=False).count() == 10

    early = on_time_near = late = graded = with_feedback = 0
    for sub in Submission.objects.select_related("assignment"):
        offset = rules.offset_seconds(sub.submitted_at, sub.assignment.due_at)
        early += offset <= -2 * 86400
        on_time_near += -4 * 3600 <= offset < 0
        late += offset > 0
        graded += sub.is_graded
        with_feedback += bool(sub.is_graded and sub.feedback)
        assert sub.submitted_at <= timezone.now()
    assert early and on_time_near and late and graded and with_feedback

    total_possible = sum(15 for _ in Assignment.objects.all())
    assert 0 < Submission.objects.count() < total_possible  # some students never submitted

    # Strict-deadline assignments only contain on-time work.
    strict = Submission.objects.filter(assignment__allow_late_submissions=False).select_related("assignment")
    assert all(rules.timing(s.submitted_at, s.assignment.due_at) == rules.ON_TIME for s in strict)

    sub = Submission.objects.first()
    data = sub.file.read()
    assert data.startswith(b"%PDF-") and data.endswith(b"%%EOF\n")
    assert uploads.validate_upload(
        name=sub.original_name,
        size=len(data),
        content_type="application/pdf",
        head=data,
        max_bytes=10 * 1024 * 1024,
    )


def test_demo_students_see_assignment_states_through_the_api(client, seeded):
    seen = set()
    for username in ("student01", "student05", "student12", "student20"):
        for item in call(client, "get", "/students/me/assignments?page_size=100", username).json()["items"]:
            seen.add(item["status"])
    assert {"GRADED", "NOT_SUBMITTED"} <= seen
    assert seen & {"SUBMITTED", "LATE", "OVERDUE_MISSING"}


def test_reset_replaces_the_demo_files(media_root, db, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        call_command("seed_demo", verbosity=0)
    before = {p.name for p in (media_root / "assignments").rglob("*.pdf")}
    assert before

    with django_capture_on_commit_callbacks(execute=True):
        call_command("seed_demo", "--reset", verbosity=0)
    after = {p.name for p in (media_root / "assignments").rglob("*.pdf")}
    assert len(after) == len(before) and before.isdisjoint(after)  # the old files are gone, new ones written


def test_reset_leaves_other_peoples_assignments_alone(media_root, db, seeded):

    keep_subject = Subject.objects.create(code="REAL1", name="Real", credits=1, semester=1)
    section = Section.objects.create(name="Z", program="Real", semester=1, academic_year="2025-2026")
    faculty = User.objects.create_user("realfac", password="x", role=Role.FACULTY)

    dept = Department.objects.create(name="Real", code="REAL")
    profile = FacultyProfile.objects.create(user=faculty, employee_id="REAL1", department=dept)
    ta = TeachingAssignment.objects.create(faculty=profile, subject=keep_subject, section=section)

    Assignment.objects.create(
        teaching_assignment=ta, title="Mine", created_by=faculty, due_at=timezone.now(), max_marks=10
    )
    call_command("seed_demo", "--reset", verbosity=0)
    assert Assignment.objects.filter(title="Mine").exists()
