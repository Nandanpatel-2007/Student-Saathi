"""Assignment business logic: scoping, submissions, grading, downloads and exports."""

import csv
import io
import uuid
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.db import IntegrityError, transaction
from django.db.models import Count, F, Q
from django.utils import timezone
from ninja.errors import HttpError

from api.csvutil import safe_cell
from api.errors import DetailedHttpError
from apps.academics.models import TeachingAssignment
from apps.accounts.models import Role, StudentProfile, User

from . import rules, uploads
from .models import Assignment, Submission

NOTE_MAX = 500

# ---------------------------------------------------------------- scoping


def _base():
    return Assignment.objects.select_related(
        "teaching_assignment__subject", "teaching_assignment__section", "teaching_assignment__faculty"
    )


def assignments_for(user: User):
    """Admin: all. Faculty: their classes. Student: classes they belong to (section and subject)."""
    qs = _base()
    if user.role == Role.ADMIN:
        return qs
    if user.role == Role.FACULTY:
        return qs.filter(teaching_assignment__faculty__user=user)
    return qs.filter(
        teaching_assignment__section__students__user=user,
        teaching_assignment__subject__enrollments__student__user=user,
    )


def _get_readable(user: User, assignment_id: int) -> Assignment:
    assignment = assignments_for(user).filter(pk=assignment_id).first()
    if assignment is None:
        raise HttpError(404, "Assignment not found")
    return assignment


def _assert_can_write(user: User, teaching_assignment: TeachingAssignment) -> None:
    if user.role == Role.ADMIN:
        return
    if user.role == Role.FACULTY and teaching_assignment.faculty.user_id == user.id:
        return
    raise PermissionDenied("Only the assigned faculty or an admin can modify this class's assignments")


def _get_writable(user: User, assignment_id: int) -> Assignment:
    assignment = _base().filter(pk=assignment_id).first()
    if assignment is None:
        raise HttpError(404, "Assignment not found")
    _assert_can_write(user, assignment.teaching_assignment)
    return assignment


def _student_profile(user: User) -> StudentProfile:
    student = StudentProfile.objects.filter(user=user).first()
    if student is None:
        raise HttpError(404, "Student profile not found")
    return student


def _roster(assignment: Assignment):
    ta = assignment.teaching_assignment
    return (
        StudentProfile.objects.filter(section_id=ta.section_id, enrollments__subject_id=ta.subject_id)
        .select_related("user")
        .order_by("roll_no")
    )


# ---------------------------------------------------------------- assignments (faculty / admin)


def _hydrate(assignments: list[Assignment]) -> list[Assignment]:
    """Attach roster size and submission counts, using two queries however many assignments there are."""
    if not assignments:
        return assignments
    counts = {
        row["id"]: row
        for row in Assignment.objects.filter(pk__in=[a.pk for a in assignments])
        .annotate(
            submitted=Count("submissions"),
            late=Count("submissions", filter=Q(submissions__submitted_at__gt=F("due_at"))),
            graded=Count("submissions", filter=Q(submissions__marks_obtained__isnull=False)),
        )
        .values("id", "submitted", "late", "graded")
    }
    pairs = {(a.teaching_assignment.section_id, a.teaching_assignment.subject_id) for a in assignments}
    roster = {
        (row["section_id"], row["enrollments__subject_id"]): row["n"]
        for row in StudentProfile.objects.filter(
            section_id__in={p[0] for p in pairs}, enrollments__subject_id__in={p[1] for p in pairs}
        )
        .values("section_id", "enrollments__subject_id")
        .annotate(n=Count("id", distinct=True))
    }
    for a in assignments:
        row = counts[a.pk]
        a.submitted_count, a.late_count, a.graded_count = row["submitted"], row["late"], row["graded"]
        a.total_students = roster.get((a.teaching_assignment.section_id, a.teaching_assignment.subject_id), 0)
    return assignments


def _aware(value):
    """A naive due date is read as the project time zone (IST); everything is stored in UTC."""
    return timezone.make_aware(value) if timezone.is_naive(value) else value


def list_assignments(user: User, teaching_assignment_id: int | None = None) -> list[Assignment]:
    qs = assignments_for(user)
    if teaching_assignment_id is not None:
        qs = qs.filter(teaching_assignment_id=teaching_assignment_id)
    return _hydrate(list(qs.order_by("-due_at", "id")))


def get_assignment(user: User, assignment_id: int) -> Assignment:
    return _hydrate([_get_readable(user, assignment_id)])[0]


def create_assignment(user: User, data: dict) -> Assignment:
    teaching_assignment = (
        TeachingAssignment.objects.select_related("faculty")
        .filter(pk=data.pop("teaching_assignment_id"))
        .first()
    )
    if teaching_assignment is None:
        raise HttpError(404, "Teaching assignment not found")
    _assert_can_write(user, teaching_assignment)
    data["due_at"] = _aware(data["due_at"])
    assignment = Assignment.objects.create(teaching_assignment=teaching_assignment, created_by=user, **data)
    return get_assignment(user, assignment.pk)


def update_assignment(user: User, assignment_id: int, data: dict) -> Assignment:
    assignment = _get_writable(user, assignment_id)
    data["due_at"] = _aware(data["due_at"])
    if Submission.objects.filter(assignment=assignment, marks_obtained__gt=data["max_marks"]).exists():
        raise DetailedHttpError(
            422,
            "Existing marks exceed the new maximum",
            [{"field": "max_marks", "message": "Some graded submissions are higher than this maximum"}],
        )
    for key, value in data.items():
        setattr(assignment, key, value)
    assignment.save()  # timing is derived, so changing due_at re-evaluates every submission automatically
    return get_assignment(user, assignment.pk)


def delete_assignment(user: User, assignment_id: int) -> None:
    _get_writable(user, assignment_id).delete()  # submissions cascade; a signal removes their files


# ---------------------------------------------------------------- derived rows


def _timing_fields(submission: Submission | None, assignment: Assignment) -> tuple[str | None, int | None]:
    if submission is None:
        return None, None
    return (
        rules.timing(submission.submitted_at, assignment.due_at),
        rules.offset_seconds(submission.submitted_at, assignment.due_at),
    )


def _status(submission: Submission | None, assignment: Assignment, tm: str | None, now) -> str:
    return rules.derive_status(
        submitted=submission is not None,
        graded=bool(submission and submission.is_graded),
        late=tm == rules.LATE,
        now=now,
        due_at=assignment.due_at,
    )


def _student_item(assignment: Assignment, submission: Submission | None, now) -> dict:
    ta = assignment.teaching_assignment
    tm, offset = _timing_fields(submission, assignment)
    return {
        "assignment_id": assignment.pk,
        "teaching_assignment_id": assignment.teaching_assignment_id,
        "title": assignment.title,
        "description": assignment.description,
        "subject": ta.subject,
        "section": ta.section,
        "due_at": assignment.due_at,
        "max_marks": assignment.max_marks,
        "allow_late_submissions": assignment.allow_late_submissions,
        "status": _status(submission, assignment, tm, now),
        "timing": tm,
        "offset_seconds": offset,
        "submission": submission,
        "marks_obtained": submission.marks_obtained if submission else None,
        "feedback": submission.feedback if submission else "",
        "graded_at": submission.graded_at if submission else None,
    }


def _row(student: StudentProfile, submission: Submission | None, assignment: Assignment, now) -> dict:
    tm, offset = _timing_fields(submission, assignment)
    return {
        "student": student,
        "status": _status(submission, assignment, tm, now),
        "timing": tm,
        "offset_seconds": offset,
        "submitted_at": submission.submitted_at if submission else None,
        "original_name": submission.original_name if submission else None,
        "size": submission.size if submission else None,
        "note": submission.note if submission else "",
        "marks_obtained": submission.marks_obtained if submission else None,
        "feedback": submission.feedback if submission else "",
        "graded_at": submission.graded_at if submission else None,
    }


# ---------------------------------------------------------------- student: list, submit, withdraw


def _parse_statuses(status: str | None) -> set[str] | None:
    if not status:
        return None
    wanted = {part.strip().upper() for part in status.split(",") if part.strip()}
    unknown = wanted - set(rules.STATUSES)
    if unknown:
        raise HttpError(422, f"Unknown status: {', '.join(sorted(unknown))}")
    return wanted


def student_assignments(user: User, status: str | None = None, subject_id: int | None = None) -> list[dict]:
    student = _student_profile(user)
    wanted = _parse_statuses(status)
    qs = assignments_for(user)
    if subject_id is not None:
        qs = qs.filter(teaching_assignment__subject_id=subject_id)
    assignments = list(qs.order_by("due_at", "id"))
    submissions = {
        s.assignment_id: s for s in Submission.objects.filter(student=student, assignment__in=assignments)
    }
    now = timezone.now()
    items = [_student_item(a, submissions.get(a.pk), now) for a in assignments]
    return [item for item in items if wanted is None or item["status"] in wanted]


def _item_for(user: User, assignment: Assignment, student: StudentProfile) -> dict:
    submission = Submission.objects.filter(assignment=assignment, student=student).first()
    return _student_item(assignment, submission, timezone.now())


def submit(user: User, assignment_id: int, upload, note: str = "") -> dict:
    student = _student_profile(user)
    assignment = _get_readable(user, assignment_id)
    now = timezone.now()

    if not assignment.allow_late_submissions and now > assignment.due_at:
        raise HttpError(409, "The deadline has passed and this assignment no longer accepts submissions.")
    note = (note or "").strip()
    if len(note) > NOTE_MAX:
        raise DetailedHttpError(
            422,
            "Note is too long",
            [{"field": "note", "message": f"Keep the note under {NOTE_MAX} characters"}],
        )

    head = upload.read(uploads.HEAD_BYTES)
    upload.seek(0)
    try:
        clean_name, ext = uploads.validate_upload(
            name=upload.name,
            size=upload.size,
            content_type=upload.content_type,
            head=head,
            max_bytes=settings.ASSIGNMENT_MAX_UPLOAD_MB * 1024 * 1024,
        )
    except uploads.UploadRejected as exc:
        raise DetailedHttpError(422, str(exc), [{"field": "file", "message": str(exc)}]) from exc

    new_file = None  # (storage, name) of the file written by this request, to clean up on failure
    try:
        with transaction.atomic():
            submission = (
                Submission.objects.select_for_update().filter(assignment=assignment, student=student).first()
            )
            if submission is not None and submission.is_graded:
                raise HttpError(409, "This submission has already been graded and can no longer be replaced.")
            previous = (
                (submission.file.storage, submission.file.name) if submission and submission.file else None
            )
            if submission is None:
                submission = Submission(assignment=assignment, student=student)
            # A random stored name: the user's file name is only kept in `original_name`.
            submission.file.save(f"{uuid.uuid4().hex}.{ext}", upload, save=False)
            new_file = (submission.file.storage, submission.file.name)
            submission.original_name = clean_name
            submission.size = upload.size
            submission.content_type = (upload.content_type or "")[:100]
            submission.note = note
            submission.submitted_at = now  # always the server clock, on every (re)submission
            submission.save()
            if previous:
                storage, name = previous
                transaction.on_commit(lambda: storage.delete(name))
    except IntegrityError as exc:
        # Two first-time uploads for the same student raced; the unique constraint let only one win.
        _discard(new_file)
        raise HttpError(409, "Your submission crossed with another one. Please check and try again.") from exc
    except Exception:
        _discard(new_file)
        raise
    return _item_for(user, assignment, student)


def _discard(new_file) -> None:
    """Delete a file this request stored, when the request then failed."""
    if new_file is not None:
        storage, name = new_file
        storage.delete(name)


def withdraw(user: User, assignment_id: int) -> None:
    student = _student_profile(user)
    assignment = _get_readable(user, assignment_id)
    submission = Submission.objects.filter(assignment=assignment, student=student).first()
    if submission is None:
        raise HttpError(404, "You have not submitted anything for this assignment")
    if submission.is_graded:
        raise HttpError(409, "This submission has already been graded and can no longer be removed.")
    submission.delete()


# ---------------------------------------------------------------- faculty / admin: submissions and grading


def list_submissions(user: User, assignment_id: int, status: str | None = None) -> list[dict]:
    assignment = _get_readable(user, assignment_id)
    wanted = _parse_statuses(status)
    submissions = {s.student_id: s for s in Submission.objects.filter(assignment=assignment)}
    now = timezone.now()
    rows = [_row(student, submissions.get(student.pk), assignment, now) for student in _roster(assignment)]
    return [row for row in rows if wanted is None or row["status"] in wanted]


def grade(user: User, assignment_id: int, student_id: int, marks: Decimal, feedback: str) -> dict:
    assignment = _get_writable(user, assignment_id)
    submission = (
        Submission.objects.select_related("student__user")
        .filter(assignment=assignment, student_id=student_id)
        .first()
    )
    if submission is None:
        raise HttpError(404, "This student has not submitted anything to grade")
    if marks > assignment.max_marks:
        raise DetailedHttpError(
            422,
            "Marks exceed the maximum",
            [
                {
                    "field": "marks_obtained",
                    "message": f"Cannot exceed the maximum of {float(assignment.max_marks):g}",
                }
            ],
        )
    submission.marks_obtained = marks
    submission.feedback = (feedback or "").strip()
    submission.graded_at = timezone.now()
    submission.graded_by = user
    submission.save(update_fields=["marks_obtained", "feedback", "graded_at", "graded_by"])
    return _row(submission.student, submission, assignment, timezone.now())


def get_downloadable(user: User, assignment_id: int, student_id: int) -> Submission:
    """The submission whose file this user may download: its student, the owning faculty, or an admin."""
    assignment = _get_readable(user, assignment_id)
    if user.role == Role.STUDENT and _student_profile(user).pk != student_id:
        raise HttpError(404, "Submission not found")
    submission = Submission.objects.filter(assignment=assignment, student_id=student_id).first()
    if submission is None or not submission.file:
        raise HttpError(404, "Submission not found")
    if not submission.file.storage.exists(submission.file.name):
        raise HttpError(404, "This file is no longer available. Ask the student to upload it again.")
    return submission


def export_csv(user: User, assignment_id: int) -> tuple[str, str]:
    assignment = _get_readable(user, assignment_id)
    rows = list_submissions(user, assignment_id)
    out = io.StringIO()
    writer = csv.writer(out)

    def write(cells):
        writer.writerow([safe_cell(c) for c in cells])

    write(
        [
            "Roll No",
            "Name",
            "Status",
            "Submitted at (IST)",
            "Timing",
            "Marks",
            f"Max marks ({float(assignment.max_marks):g})",
            "File",
        ]
    )
    for row in rows:
        submitted = (
            timezone.localtime(row["submitted_at"]).isoformat(timespec="seconds")
            if row["submitted_at"]
            else ""
        )
        write(
            [
                row["student"].roll_no,
                row["student"].user.display_name,
                row["status"],
                submitted,
                rules.timing_text(row["offset_seconds"]) if row["offset_seconds"] is not None else "",
                "" if row["marks_obtained"] is None else f"{float(row['marks_obtained']):g}",
                f"{float(assignment.max_marks):g}",
                row["original_name"] or "",
            ]
        )
    ta = assignment.teaching_assignment
    name = f"{ta.subject.code}-{ta.section.name}-assignment-{assignment.pk}.csv".replace(" ", "_")
    return name, out.getvalue()
