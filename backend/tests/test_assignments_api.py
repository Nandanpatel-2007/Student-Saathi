import csv
import datetime as dt
import io
import json
from pathlib import Path

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.academics.models import Enrollment, Section, Subject, TeachingAssignment
from apps.accounts.models import FacultyProfile, Role, StudentProfile, User
from apps.assessments.models import Assessment, Mark
from apps.assignments import rules
from apps.assignments.models import Assignment, Submission

from .conftest import PASSWORD, auth_header, call

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"


def upload(name="work.pdf", body=PDF, content_type="application/pdf"):
    return SimpleUploadedFile(name, body, content_type=content_type)


def submit(client, username, assignment, file=None, note="", **extra):
    data = {"file": file or upload(), "note": note, **extra}
    return client.post(
        f"/api/v1/assignments/{assignment.id}/submission", data=data, **auth_header(client, username)
    )


def make_student(username, roll_no, section, first=""):
    user = User.objects.create_user(username, password=PASSWORD, first_name=first or username)
    return StudentProfile.objects.create(user=user, roll_no=roll_no, section=section, admission_year=2024)


def make_assignment(teaching_assignment, owner, *, due_in=dt.timedelta(days=2), **kw):
    defaults = dict(title="Essay", max_marks=20, allow_late_submissions=True)
    defaults.update(kw)
    return Assignment.objects.create(
        teaching_assignment=teaching_assignment, created_by=owner, due_at=timezone.now() + due_in, **defaults
    )


def make_submission(assignment, student, *, at, name="w.pdf", **kw):
    sub = Submission(
        assignment=assignment, student=student, original_name=name, size=len(PDF), submitted_at=at, **kw
    )
    sub.file.save("stored.pdf", SimpleUploadedFile(name, PDF), save=False)
    sub.save()
    return sub


@pytest.fixture
def subject(db):
    return Subject.objects.create(code="CS301", name="Algorithms", credits=4, semester=3)


@pytest.fixture
def klass(faculty_user, subject, section):
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
    elsewhere_section = Section.objects.create(
        name="B", program="B.Tech", semester=3, academic_year="2025-2026"
    )
    elsewhere = make_student("stu4", "R004", elsewhere_section)
    for s in (s1, s2, elsewhere):
        Enrollment.objects.create(student=s, subject=subject)
    return {"s1": s1, "s2": s2, "not_enrolled": not_enrolled, "elsewhere": elsewhere}


@pytest.fixture
def work(klass, faculty_user, roster):
    return make_assignment(klass, faculty_user)


# ------------------------------------------------------------------ create / edit / delete


def body(klass, **over):
    data = {
        "teaching_assignment_id": klass.id,
        "title": "Essay 1",
        "description": "Write about sorting.",
        "due_at": (timezone.now() + dt.timedelta(days=3)).isoformat(),
        "max_marks": 20,
        "allow_late_submissions": True,
    }
    data.update(over)
    return data


def test_faculty_creates_edits_and_deletes_an_assignment(client, klass, roster):
    res = call(client, "post", "/assignments", "fac1", body(klass))
    assert res.status_code == 201
    created = res.json()
    assert created["title"] == "Essay 1" and created["max_marks"] == 20
    assert created["subject"]["code"] == "CS301" and created["total_students"] == 2
    assert (created["submitted_count"], created["late_count"], created["graded_count"]) == (0, 0, 0)

    new_due = (timezone.now() + dt.timedelta(days=9)).isoformat()
    update = {
        k: v
        for k, v in body(klass, title="Essay one", due_at=new_due).items()
        if k != "teaching_assignment_id"
    }
    res = call(client, "put", f"/assignments/{created['id']}", "fac1", update)
    assert res.status_code == 200 and res.json()["title"] == "Essay one"

    assert call(client, "get", f"/assignments/{created['id']}", "fac1").json()["title"] == "Essay one"
    assert call(client, "delete", f"/assignments/{created['id']}", "fac1").status_code == 204
    assert call(client, "get", f"/assignments/{created['id']}", "fac1").status_code == 404


def test_a_due_date_without_an_offset_is_read_as_ist(client, klass, roster):
    res = call(client, "post", "/assignments", "fac1", body(klass, due_at="2030-01-15T17:00:00"))
    assert res.status_code == 201
    assert Assignment.objects.get().due_at == dt.datetime(2030, 1, 15, 11, 30, tzinfo=dt.UTC)  # 17:00 IST


@pytest.mark.parametrize(
    "bad",
    [{"max_marks": 0}, {"max_marks": -1}, {"title": ""}, {"title": "x" * 151}, {"due_at": "next friday"}],
)
def test_assignment_validation(client, klass, roster, bad):
    assert call(client, "post", "/assignments", "fac1", body(klass, **bad)).status_code == 422


def test_only_the_owning_faculty_or_admin_can_write(
    client, klass, work, other_faculty, student_user, admin_user
):
    assert call(client, "post", "/assignments", "fac2", body(klass)).status_code == 403
    assert call(client, "post", "/assignments", "stu1", body(klass)).status_code == 403
    assert call(client, "post", "/assignments", None, body(klass)).status_code == 401
    assert call(client, "post", "/assignments", "admin1", body(klass)).status_code == 201
    update = {k: v for k, v in body(klass).items() if k != "teaching_assignment_id"}
    assert call(client, "put", f"/assignments/{work.id}", "fac2", update).status_code == 403
    assert call(client, "delete", f"/assignments/{work.id}", "fac2").status_code == 403
    assert call(client, "get", f"/assignments/{work.id}", "fac2").status_code == 404
    assert call(client, "get", f"/assignments/{work.id}", "stu1").status_code == 403
    assert Assignment.objects.filter(pk=work.pk).exists()


def test_unknown_class_is_404(client, faculty_user):
    assert call(client, "post", "/assignments", "fac1", body(type("T", (), {"id": 999}))).status_code == 404


def test_list_is_scoped_and_filterable(client, klass, work, other_faculty, subject, section, faculty_user):
    elsewhere = TeachingAssignment.objects.create(
        faculty=other_faculty,
        subject=Subject.objects.create(code="CS302", name="DB", credits=3, semester=3),
        section=section,
    )
    make_assignment(elsewhere, other_faculty.user, title="Theirs")
    mine = call(client, "get", "/assignments", "fac1").json()
    assert mine["count"] == 1 and mine["items"][0]["title"] == "Essay"
    assert (
        call(client, "get", f"/assignments?teaching_assignment_id={elsewhere.id}", "fac1").json()["count"]
        == 0
    )


def test_lowering_max_marks_below_a_grade_is_rejected(client, klass, work, roster):
    make_submission(work, roster["s1"], at=timezone.now(), marks_obtained=18)
    update = {k: v for k, v in body(klass, max_marks=15).items() if k != "teaching_assignment_id"}
    res = call(client, "put", f"/assignments/{work.id}", "fac1", update)
    assert res.status_code == 422 and res.json()["error"]["details"][0]["field"] == "max_marks"


def test_deleting_an_assignment_removes_its_files(
    client, work, roster, media_root, django_capture_on_commit_callbacks
):
    make_submission(work, roster["s1"], at=timezone.now())
    stored = list((media_root / "assignments").rglob("*.pdf"))
    assert len(stored) == 1
    with django_capture_on_commit_callbacks(execute=True):
        assert call(client, "delete", f"/assignments/{work.id}", "fac1").status_code == 204
    assert not Submission.objects.exists() and not any((media_root / "assignments").rglob("*.pdf"))


# ------------------------------------------------------------------ student visibility


def test_students_see_only_assignments_of_their_own_classes(
    client, klass, work, roster, other_faculty, section
):
    other_subject = Subject.objects.create(code="CS302", name="DB", credits=3, semester=3)
    other_class = TeachingAssignment.objects.create(
        faculty=other_faculty, subject=other_subject, section=section
    )
    make_assignment(other_class, other_faculty.user, title="Not enrolled in this subject")

    page = call(client, "get", "/students/me/assignments", "stu1").json()
    assert [a["title"] for a in page["items"]] == ["Essay"]
    assert page["items"][0]["status"] == "NOT_SUBMITTED" and page["items"][0]["subject"]["code"] == "CS301"

    # A classmate in another section, and a student not enrolled in the subject, see nothing of it.
    assert call(client, "get", "/students/me/assignments", "stu4").json()["count"] == 0
    assert call(client, "get", "/students/me/assignments", "stu3").json()["count"] == 0
    assert submit(client, "stu3", work).status_code == 404
    assert submit(client, "stu4", work).status_code == 404


def test_student_endpoints_reject_other_roles(client, work, faculty_user, admin_user):
    assert call(client, "get", "/students/me/assignments", "fac1").status_code == 403
    assert call(client, "get", "/students/me/assignments", "admin1").status_code == 403
    assert call(client, "get", "/students/me/assignments").status_code == 401
    assert submit(client, "fac1", work).status_code == 403


# ------------------------------------------------------------------ submitting


def test_submit_stores_the_file_privately_and_the_server_sets_the_time(client, work, roster, media_root):
    before = timezone.now()
    res = submit(
        client,
        "stu1",
        work,
        upload("../My Essay (final).pdf"),
        note="  see page 2 ",
        submitted_at="2000-01-01T00:00:00Z",
    )
    assert res.status_code == 200, res.content
    item = res.json()
    sub = Submission.objects.get()

    assert before <= sub.submitted_at <= timezone.now()  # the client's value is ignored
    assert item["status"] == "SUBMITTED" and item["timing"] == "ON_TIME" and item["offset_seconds"] < 0
    assert item["submission"]["original_name"] == "My Essay (final).pdf"
    assert item["submission"]["note"] == "see page 2" and item["submission"]["size"] == len(PDF)

    stored = Path(sub.file.path)
    assert stored.is_file() and stored.read_bytes() == PDF
    assert media_root in stored.parents and f"assignments/{work.id}/" in stored.as_posix()
    assert (
        stored.name != "My Essay (final).pdf" and stored.suffix == ".pdf" and len(stored.stem) == 32
    )  # random name
    assert "/media/" not in json.dumps(item) and "file" not in item["submission"]  # no public URL is exposed


@pytest.mark.parametrize(
    ("file", "message"),
    [
        (lambda: upload("malware.exe", b"MZ", "application/x-msdownload"), "isn’t allowed"),
        (lambda: upload("empty.pdf", b""), "empty"),
        (lambda: upload("fake.pdf", b"MZ not a pdf at all"), "contents"),
        (lambda: upload("page.pdf", PDF, "text/html"), "doesn’t match"),
        (lambda: upload("bin.txt", b"abc\x00def", "text/plain"), "plain text"),
    ],
)
def test_upload_validation_errors_reach_the_user(client, work, roster, file, message):
    res = submit(client, "stu1", work, file())
    assert res.status_code == 422
    err = res.json()["error"]
    assert message in err["message"] and err["details"][0]["field"] == "file"
    assert not Submission.objects.exists()


def test_upload_size_limit_comes_from_settings(client, work, roster, settings):
    settings.ASSIGNMENT_MAX_UPLOAD_MB = 1
    limit = 1024 * 1024
    ok = submit(client, "stu1", work, upload("a.txt", b"a" * limit, "text/plain"))
    assert ok.status_code == 200
    big = submit(client, "stu2", work, upload("b.txt", b"a" * (limit + 1), "text/plain"))
    assert big.status_code == 422 and "1 MB" in big.json()["error"]["message"]


def test_missing_file_and_long_notes_are_rejected(client, work, roster):
    res = client.post(
        f"/api/v1/assignments/{work.id}/submission", data={"note": "x"}, **auth_header(client, "stu1")
    )
    assert res.status_code == 422
    assert submit(client, "stu1", work, note="n" * 501).status_code == 422
    assert submit(client, "stu1", work, note="n" * 500).status_code == 200


def test_resubmitting_replaces_the_file_and_moves_submitted_at(
    client, work, roster, media_root, django_capture_on_commit_callbacks
):
    assert submit(client, "stu1", work, upload("v1.pdf", PDF + b"one")).status_code == 200
    first = Submission.objects.get()
    first_path, first_time = Path(first.file.path), first.submitted_at

    with django_capture_on_commit_callbacks(execute=True):
        assert (
            submit(client, "stu1", work, upload("v2.pdf", PDF + b"two"), note="fixed typos").status_code
            == 200
        )

    second = Submission.objects.get()  # still one row per student
    assert second.original_name == "v2.pdf" and second.note == "fixed typos"
    assert second.submitted_at > first_time
    assert not first_path.exists() and Path(second.file.path).read_bytes() == PDF + b"two"
    assert len(list((media_root / "assignments").rglob("*.pdf"))) == 1


def test_a_graded_submission_cannot_be_replaced_or_withdrawn(client, work, roster):
    assert submit(client, "stu1", work).status_code == 200
    assert (
        call(
            client,
            "put",
            f"/assignments/{work.id}/submissions/{roster['s1'].id}/grade",
            "fac1",
            {"marks_obtained": 15, "feedback": "Good"},
        ).status_code
        == 200
    )

    res = submit(client, "stu1", work, upload("v2.pdf"))
    assert res.status_code == 409 and "already been graded" in res.json()["error"]["message"]
    assert call(client, "delete", f"/assignments/{work.id}/submission", "stu1").status_code == 409
    assert Submission.objects.get().original_name == "work.pdf"


def test_withdrawing_before_grading_removes_the_row_and_the_file(
    client, work, roster, media_root, django_capture_on_commit_callbacks
):
    submit(client, "stu1", work)
    with django_capture_on_commit_callbacks(execute=True):
        assert call(client, "delete", f"/assignments/{work.id}/submission", "stu1").status_code == 204
    assert not Submission.objects.exists() and not any((media_root / "assignments").rglob("*.pdf"))
    assert call(client, "delete", f"/assignments/{work.id}/submission", "stu1").status_code == 404


# ------------------------------------------------------------------ lateness


def test_late_submissions_are_accepted_and_flagged_when_allowed(client, klass, faculty_user, roster):
    late_work = make_assignment(
        klass, faculty_user, due_in=dt.timedelta(hours=-3), allow_late_submissions=True
    )
    res = submit(client, "stu1", late_work)
    assert res.status_code == 200
    item = res.json()
    assert item["status"] == "LATE" and item["timing"] == "LATE"
    assert 3 * 3600 <= item["offset_seconds"] < 3 * 3600 + 60


def test_late_submissions_are_refused_when_not_allowed(client, klass, faculty_user, roster):
    closed = make_assignment(
        klass, faculty_user, due_in=dt.timedelta(minutes=-1), allow_late_submissions=False
    )
    res = submit(client, "stu1", closed)
    assert res.status_code == 409 and "no longer accepts submissions" in res.json()["error"]["message"]
    assert not Submission.objects.exists()
    still_open = make_assignment(
        klass, faculty_user, due_in=dt.timedelta(hours=1), allow_late_submissions=False
    )
    assert submit(client, "stu1", still_open).status_code == 200


def test_missing_work_after_the_deadline_is_overdue(client, klass, faculty_user, roster):
    make_assignment(klass, faculty_user, due_in=dt.timedelta(days=-1), title="Old")
    item = call(client, "get", "/students/me/assignments", "stu1").json()["items"][0]
    assert item["status"] == "OVERDUE_MISSING" and item["timing"] is None and item["offset_seconds"] is None


def test_offsets_are_exact_for_early_late_and_on_the_deadline(client, klass, faculty_user, roster, section):
    due = timezone.now() + dt.timedelta(days=1)
    work = Assignment.objects.create(
        teaching_assignment=klass, created_by=faculty_user, title="T", due_at=due, max_marks=10
    )
    third = make_student("stu5", "R005", section)
    Enrollment.objects.create(student=third, subject=klass.subject)
    make_submission(work, roster["s1"], at=due - dt.timedelta(days=2))
    make_submission(work, roster["s2"], at=due + dt.timedelta(days=3))
    make_submission(work, third, at=due)

    rows = {
        r["student"]["roll_no"]: r
        for r in call(client, "get", f"/assignments/{work.id}/submissions", "fac1").json()["items"]
    }
    assert (rows["R001"]["offset_seconds"], rows["R001"]["timing"], rows["R001"]["status"]) == (
        -172800,
        "ON_TIME",
        "SUBMITTED",
    )
    assert (rows["R002"]["offset_seconds"], rows["R002"]["timing"], rows["R002"]["status"]) == (
        259200,
        "LATE",
        "LATE",
    )
    assert (rows["R005"]["offset_seconds"], rows["R005"]["timing"], rows["R005"]["status"]) == (
        0,
        "ON_TIME",
        "SUBMITTED",
    )
    assert rules.timing_text(rows["R001"]["offset_seconds"]) == "2 days before the deadline"
    assert rules.timing_text(rows["R002"]["offset_seconds"]) == "3 days late"


def test_editing_the_due_date_recomputes_timing_for_existing_submissions(client, klass, work, roster):
    sub = make_submission(work, roster["s1"], at=work.due_at - dt.timedelta(hours=5))
    assert (
        call(client, "get", f"/assignments/{work.id}/submissions", "fac1").json()["items"][0]["timing"]
        == "ON_TIME"
    )

    earlier = (sub.submitted_at - dt.timedelta(hours=1)).isoformat()
    update = {k: v for k, v in body(klass, due_at=earlier).items() if k != "teaching_assignment_id"}
    assert call(client, "put", f"/assignments/{work.id}", "fac1", update).json()["late_count"] == 1
    row = call(client, "get", f"/assignments/{work.id}/submissions", "fac1").json()["items"][0]
    assert (row["timing"], row["status"], row["offset_seconds"]) == ("LATE", "LATE", 3600)


# ------------------------------------------------------------------ the faculty submissions list


def test_the_submissions_list_shows_every_enrolled_student(client, work, roster):
    make_submission(work, roster["s1"], at=timezone.now(), note="done")
    page = call(client, "get", f"/assignments/{work.id}/submissions", "fac1").json()
    rows = {r["student"]["roll_no"]: r for r in page["items"]}
    assert set(rows) == {"R001", "R002", "R004"} - {"R004"}  # not the unenrolled or other-section students
    assert (
        rows["R001"]["status"] == "SUBMITTED"
        and rows["R001"]["original_name"] == "w.pdf"
        and rows["R001"]["note"] == "done"
    )
    assert rows["R002"]["status"] == "NOT_SUBMITTED" and rows["R002"]["submitted_at"] is None


def test_the_submissions_list_can_be_filtered_by_status(client, klass, faculty_user, roster):
    work = make_assignment(klass, faculty_user, due_in=dt.timedelta(hours=-5))
    make_submission(work, roster["s1"], at=work.due_at + dt.timedelta(hours=1))
    url = f"/assignments/{work.id}/submissions"
    assert [
        r["student"]["roll_no"] for r in call(client, "get", f"{url}?status=LATE", "fac1").json()["items"]
    ] == ["R001"]
    assert [
        r["student"]["roll_no"]
        for r in call(client, "get", f"{url}?status=OVERDUE_MISSING", "fac1").json()["items"]
    ] == ["R002"]
    assert call(client, "get", f"{url}?status=LATE,OVERDUE_MISSING", "fac1").json()["count"] == 2
    assert call(client, "get", f"{url}?status=BOGUS", "fac1").status_code == 422


def test_submissions_are_visible_only_to_the_owning_faculty_and_admin(
    client, work, roster, other_faculty, admin_user
):
    url = f"/assignments/{work.id}/submissions"
    assert call(client, "get", url, "fac1").status_code == 200
    assert call(client, "get", url, "admin1").status_code == 200
    assert call(client, "get", url, "fac2").status_code == 404
    assert call(client, "get", url, "stu1").status_code == 403


# ------------------------------------------------------------------ grading


def grade(client, user, work, student, **payload):
    return call(client, "put", f"/assignments/{work.id}/submissions/{student.id}/grade", user, payload)


def test_grading_stores_marks_feedback_and_status(client, work, roster, faculty_user):
    make_submission(work, roster["s1"], at=work.due_at - dt.timedelta(hours=1))
    res = grade(client, "fac1", work, roster["s1"], marks_obtained=17.5, feedback="  Nice structure.  ")
    assert res.status_code == 200
    row = res.json()
    assert (
        row["status"] == "GRADED" and row["marks_obtained"] == 17.5 and row["feedback"] == "Nice structure."
    )
    sub = Submission.objects.get()
    assert sub.graded_by == faculty_user and sub.graded_at is not None

    again = grade(
        client, "fac1", work, roster["s1"], marks_obtained=18, feedback="Revised."
    )  # re-grading is allowed
    assert again.json()["marks_obtained"] == 18

    mine = call(client, "get", "/students/me/assignments", "stu1").json()["items"][0]
    assert mine["status"] == "GRADED" and mine["marks_obtained"] == 18 and mine["feedback"] == "Revised."
    assert mine["graded_at"] is not None


def test_a_late_graded_submission_keeps_its_late_timing(client, klass, faculty_user, roster):
    work = make_assignment(klass, faculty_user, due_in=dt.timedelta(days=-2))
    make_submission(work, roster["s1"], at=work.due_at + dt.timedelta(hours=4))
    grade(client, "fac1", work, roster["s1"], marks_obtained=10)
    row = call(client, "get", f"/assignments/{work.id}/submissions", "fac1").json()["items"][0]
    assert (row["status"], row["timing"], row["offset_seconds"]) == ("GRADED", "LATE", 4 * 3600)


@pytest.mark.parametrize("marks", [21, 20.01, -1])
def test_grade_validation(client, work, roster, marks):
    make_submission(work, roster["s1"], at=timezone.now())
    res = grade(client, "fac1", work, roster["s1"], marks_obtained=marks)
    assert res.status_code == 422
    assert Submission.objects.get().marks_obtained is None


def test_the_maximum_mark_and_zero_are_valid(client, work, roster):
    make_submission(work, roster["s1"], at=timezone.now())
    assert grade(client, "fac1", work, roster["s1"], marks_obtained=20).status_code == 200
    assert grade(client, "fac1", work, roster["s1"], marks_obtained=0).json()["marks_obtained"] == 0


def test_over_maximum_marks_name_the_field(client, work, roster):
    make_submission(work, roster["s1"], at=timezone.now())
    err = grade(client, "fac1", work, roster["s1"], marks_obtained=99).json()["error"]
    assert err["details"][0]["field"] == "marks_obtained" and "20" in err["details"][0]["message"]


def test_only_existing_submissions_can_be_graded(client, work, roster):
    assert grade(client, "fac1", work, roster["s2"], marks_obtained=5).status_code == 404


def test_grading_permissions(client, work, roster, other_faculty, admin_user):
    make_submission(work, roster["s1"], at=timezone.now())
    assert grade(client, "fac2", work, roster["s1"], marks_obtained=5).status_code in (403, 404)
    assert grade(client, "stu1", work, roster["s1"], marks_obtained=5).status_code == 403
    assert Submission.objects.get().marks_obtained is None
    assert grade(client, "admin1", work, roster["s1"], marks_obtained=5).status_code == 200


# ------------------------------------------------------------------ downloads


def download(client, user, work, student):
    kwargs = auth_header(client, user) if user else {}
    return client.get(f"/api/v1/assignments/{work.id}/submissions/{student.id}/file", **kwargs)


def test_download_is_an_attachment_with_the_original_name(client, work, roster):
    submit(client, "stu1", work, upload("Essay v2.pdf", PDF + b"x"))
    res = download(client, "stu1", work, roster["s1"])
    assert res.status_code == 200
    assert b"".join(res.streaming_content) == PDF + b"x"
    assert 'attachment; filename="Essay v2.pdf"' in res["Content-Disposition"]
    assert res["X-Content-Type-Options"] == "nosniff" and "no-store" in res["Cache-Control"]


def test_who_can_download_a_file(client, work, roster, other_faculty, admin_user):
    submit(client, "stu1", work)
    assert download(client, "stu1", work, roster["s1"]).status_code == 200
    assert download(client, "fac1", work, roster["s1"]).status_code == 200
    assert download(client, "admin1", work, roster["s1"]).status_code == 200
    assert download(client, "stu2", work, roster["s1"]).status_code == 404  # another student
    assert download(client, "stu4", work, roster["s1"]).status_code == 404  # other section
    assert download(client, "fac2", work, roster["s1"]).status_code == 404  # another faculty
    assert download(client, None, work, roster["s1"]).status_code == 401
    assert download(client, "fac1", work, roster["s2"]).status_code == 404  # nothing submitted


def test_there_is_no_public_media_route(client, work, roster, media_root):
    submit(client, "stu1", work)
    stored = Submission.objects.get().file.name
    assert Client().get(f"/media/{stored}").status_code == 404
    assert Client().get(f"/api/v1/media/{stored}").status_code == 404


# ------------------------------------------------------------------ student list


def test_student_list_filters_by_status_and_subject(client, klass, faculty_user, roster, subject):
    old = make_assignment(klass, faculty_user, due_in=dt.timedelta(days=-3), title="Old")
    soon = make_assignment(klass, faculty_user, due_in=dt.timedelta(days=1), title="Soon")
    make_assignment(klass, faculty_user, due_in=dt.timedelta(days=9), title="Later")
    make_submission(soon, roster["s1"], at=timezone.now())
    make_submission(
        old, roster["s1"], at=old.due_at + dt.timedelta(hours=1), marks_obtained=12, feedback="ok"
    )

    def titles(query=""):
        return [
            i["title"]
            for i in call(client, "get", f"/students/me/assignments{query}", "stu1").json()["items"]
        ]

    assert titles() == ["Old", "Soon", "Later"]  # by due date
    assert titles("?status=GRADED") == ["Old"]
    assert titles("?status=SUBMITTED") == ["Soon"]
    assert titles("?status=NOT_SUBMITTED") == ["Later"]
    assert titles("?status=SUBMITTED,GRADED") == ["Old", "Soon"]
    assert titles(f"?subject={subject.id}") == ["Old", "Soon", "Later"]
    assert titles("?subject=99999") == []
    assert call(client, "get", "/students/me/assignments?status=NOPE", "stu1").status_code == 422


# ------------------------------------------------------------------ CSV export


def test_csv_export_has_ist_timestamps_and_timing_text(client, work, roster):
    work.due_at = dt.datetime(2030, 3, 1, 12, 0, tzinfo=dt.UTC)
    work.save()
    roster["s1"].user.first_name = "=HYPERLINK(1)"
    roster["s1"].user.save()
    make_submission(work, roster["s1"], at=dt.datetime(2030, 2, 27, 12, 0, tzinfo=dt.UTC), marks_obtained=15)
    make_submission(work, roster["s2"], at=dt.datetime(2030, 3, 4, 16, 0, tzinfo=dt.UTC))

    res = call(client, "get", f"/assignments/{work.id}/export", "fac1")
    assert res.status_code == 200 and res["Content-Type"].startswith("text/csv")
    assert "attachment" in res["Content-Disposition"]
    rows = list(csv.reader(io.StringIO(res.content.decode())))
    assert rows[0][:6] == ["Roll No", "Name", "Status", "Submitted at (IST)", "Timing", "Marks"]
    first, second = rows[1], rows[2]
    assert first[1].startswith("'=HYPERLINK(1)") and first[2] == "GRADED"
    assert (
        first[3] == "2030-02-27T17:30:00+05:30"
        and first[4] == "2 days before the deadline"
        and first[5] == "15"
    )
    assert (
        second[2] == "LATE"
        and second[3] == "2030-03-04T21:30:00+05:30"
        and second[4] == "3 days 4 hours late"
    )
    assert call(client, "get", f"/assignments/{work.id}/export", "stu1").status_code == 403


# ------------------------------------------------------------------ analytics integration


def dashboard(client, user="stu1"):
    return call(client, "get", "/students/me/dashboard", user).json()["subjects"][0]


def test_graded_assignments_count_in_the_average_but_ungraded_ones_do_not(
    client, klass, faculty_user, roster
):
    quiz = Assessment.objects.create(
        teaching_assignment=klass,
        title="Quiz",
        type="QUIZ",
        max_marks=10,
        date=dt.date.today() - dt.timedelta(days=10),
    )
    Mark.objects.create(assessment=quiz, student=roster["s1"], marks_obtained=9)  # 90%
    graded = make_assignment(klass, faculty_user, due_in=dt.timedelta(days=-3), max_marks=50)
    make_submission(graded, roster["s1"], at=graded.due_at, marks_obtained=40)  # 80%
    pending = make_assignment(klass, faculty_user, due_in=dt.timedelta(days=-2), title="Pending")
    make_submission(pending, roster["s1"], at=pending.due_at)  # submitted, not graded: ignored
    make_assignment(
        klass, faculty_user, due_in=dt.timedelta(days=5), title="Missing"
    )  # nothing at all: ignored

    assert dashboard(client)["average_score_pct"] == pytest.approx(85)  # mean of 90 and 80


def test_class_average_includes_assignment_marks(client, klass, faculty_user, roster):
    graded = make_assignment(klass, faculty_user, due_in=dt.timedelta(days=-3), max_marks=100)
    make_submission(graded, roster["s1"], at=graded.due_at, marks_obtained=90)
    make_submission(graded, roster["s2"], at=graded.due_at, marks_obtained=50)
    assert dashboard(client)["class_avg_score_pct"] == pytest.approx(70)
    row = {
        r["student"]["roll_no"]: r
        for r in call(client, "get", f"/faculty/classes/{klass.id}/students", "fac1").json()["items"]
    }
    assert row["R001"]["diff_from_class_score"] == pytest.approx(20) and row["R002"][
        "diff_from_class_score"
    ] == pytest.approx(-20)


def test_assignment_marks_take_part_in_the_sharp_drop_ordered_by_due_date(
    client, klass, faculty_user, roster
):
    today = dt.date.today()
    quiz = Assessment.objects.create(
        teaching_assignment=klass,
        title="Quiz",
        type="QUIZ",
        max_marks=100,
        date=today - dt.timedelta(days=20),
    )
    Mark.objects.create(assessment=quiz, student=roster["s1"], marks_obtained=90)
    early = make_assignment(klass, faculty_user, due_in=dt.timedelta(days=-10), max_marks=100, title="A1")
    make_submission(early, roster["s1"], at=early.due_at, marks_obtained=85)
    assert "SHARP_DROP" not in {a["code"] for a in dashboard(client)["alerts"]}  # 90 -> 85

    late = make_assignment(klass, faculty_user, due_in=dt.timedelta(days=-2), max_marks=100, title="A2")
    make_submission(late, roster["s1"], at=late.due_at, marks_obtained=50)  # 85 -> 50
    codes = {a["code"] for a in dashboard(client)["alerts"]}
    assert "SHARP_DROP" in codes


def test_class_summary_counts_submissions_waiting_for_marks(client, klass, work, roster):
    make_submission(work, roster["s1"], at=timezone.now())
    make_submission(work, roster["s2"], at=timezone.now(), marks_obtained=10)
    assert (
        call(client, "get", f"/faculty/classes/{klass.id}/summary", "fac1").json()["submissions_to_grade"]
        == 1
    )


def test_marks_csv_includes_graded_assignment_columns(client, klass, faculty_user, roster):
    graded = make_assignment(klass, faculty_user, due_in=dt.timedelta(days=-1), max_marks=20, title="Essay")
    make_submission(graded, roster["s1"], at=graded.due_at, marks_obtained=15)
    text = call(client, "get", f"/faculty/classes/{klass.id}/export?type=marks", "fac1").content.decode()
    rows = list(csv.reader(io.StringIO(text)))
    assert "Essay (/20, assignment)" in rows[0]
    column = rows[0].index("Essay (/20, assignment)")
    assert rows[1][column] == "15" and rows[2][column] == ""
    assert rows[1][-2] == "75.0"  # the average is just this one graded item


# ------------------------------------------------------------------ N+1 guards


def count_queries(client, path, user):
    headers = auth_header(client, user)
    with CaptureQueriesContext(connection) as ctx:
        assert client.get(f"/api/v1{path}", **headers).status_code == 200
    return len(ctx)


def test_submissions_list_query_count_is_constant(client, klass, work, roster, section):
    paths = [
        f"/assignments/{work.id}/submissions",
        f"/assignments/{work.id}/export",
        f"/assignments?teaching_assignment_id={klass.id}",
    ]
    baseline = [count_queries(client, p, "fac1") for p in paths]
    for n in range(10, 30):
        s = make_student(f"extra{n}", f"X{n:03d}", section)
        Enrollment.objects.create(student=s, subject=klass.subject)
        make_submission(work, s, at=timezone.now())
    assert [count_queries(client, p, "fac1") for p in paths] == baseline
    assert max(baseline) <= 10


def test_student_list_query_count_is_constant(client, klass, faculty_user, roster):
    work = make_assignment(klass, faculty_user)
    make_submission(work, roster["s1"], at=timezone.now())
    baseline = count_queries(client, "/students/me/assignments", "stu1")
    for i in range(8):
        extra = make_assignment(klass, faculty_user, title=f"More {i}", due_in=dt.timedelta(days=i - 4))
        make_submission(extra, roster["s1"], at=timezone.now(), marks_obtained=5)
    assert count_queries(client, "/students/me/assignments", "stu1") == baseline
    assert baseline <= 8


def test_dashboard_query_count_stays_constant_with_assignments(client, klass, faculty_user, roster):
    baseline = count_queries(client, "/students/me/dashboard", "stu1")
    for i in range(6):
        extra = make_assignment(klass, faculty_user, title=f"A{i}", due_in=dt.timedelta(days=-i - 1))
        make_submission(extra, roster["s1"], at=extra.due_at, marks_obtained=10)
    assert count_queries(client, "/students/me/dashboard", "stu1") == baseline


# ------------------------------------------------------------------ hardening


def test_a_file_missing_from_disk_is_a_clean_404_not_a_500(client, work, roster):
    submit(client, "stu1", work)
    Path(Submission.objects.get().file.path).unlink()
    res = download(client, "stu1", work, roster["s1"])
    assert res.status_code == 404 and "no longer available" in res.json()["error"]["message"]


def test_a_crossed_first_upload_is_a_409_and_leaves_no_orphan_file(
    client, work, roster, media_root, monkeypatch
):
    from django.db import IntegrityError

    def collide(self, *args, **kwargs):
        raise IntegrityError("duplicate key")

    monkeypatch.setattr(Submission, "save", collide)
    res = submit(client, "stu1", work)
    assert res.status_code == 409 and res.json()["error"]["code"] == "conflict"
    assert not list((media_root / "assignments").rglob("*.pdf"))  # the half-written file was removed


def test_an_unexpected_failure_also_removes_the_new_file(client, work, roster, media_root, monkeypatch):
    def boom(self, *args, **kwargs):
        raise RuntimeError("disk on fire")

    monkeypatch.setattr(Submission, "save", boom)
    res = submit(client, "stu1", work)
    assert res.status_code == 500 and res.json()["error"]["code"] == "server_error"  # standard envelope
    assert "disk on fire" not in res.content.decode()  # internals are not leaked
    assert not list((media_root / "assignments").rglob("*.pdf"))


def test_a_failed_replacement_keeps_the_previous_file(client, work, roster, media_root, monkeypatch):
    assert submit(client, "stu1", work).status_code == 200
    original = Submission.objects.get()
    kept = Path(original.file.path)

    def boom(self, *args, **kwargs):
        raise RuntimeError("nope")

    monkeypatch.setattr(Submission, "save", boom)
    assert submit(client, "stu1", work, upload("v2.pdf", PDF + b"x")).status_code == 500
    monkeypatch.undo()
    assert kept.is_file() and len(list((media_root / "assignments").rglob("*.pdf"))) == 1
    assert Submission.objects.get().original_name == "work.pdf"


def test_unicode_and_spaced_file_names_survive_the_round_trip(client, work, roster):
    submit(client, "stu1", work, upload("Résumé – final (2).pdf"))
    assert Submission.objects.get().original_name == "Résumé – final (2).pdf"
    res = download(client, "stu1", work, roster["s1"])
    assert res.status_code == 200 and "filename" in res["Content-Disposition"]
