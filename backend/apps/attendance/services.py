"""Attendance business logic: session creation, bulk edits, audit trail."""

import datetime as dt

from django.core.exceptions import PermissionDenied
from django.db import IntegrityError, transaction
from django.db.models import Count, Prefetch, Q
from django.utils import timezone
from ninja.errors import HttpError

from apps.academics.models import TeachingAssignment
from apps.accounts.models import Role, StudentProfile, User

from .models import AttendanceAuditLog, AttendanceRecord, AttendanceSession, AttendanceStatus

# ---------------------------------------------------------------- querysets


def _with_counts(qs):
    S = AttendanceStatus
    return qs.annotate(
        total=Count("records"),
        present=Count("records", filter=Q(records__status=S.PRESENT)),
        absent=Count("records", filter=Q(records__status=S.ABSENT)),
        late=Count("records", filter=Q(records__status=S.LATE)),
        excused=Count("records", filter=Q(records__status=S.EXCUSED)),
    )


def sessions_for(user: User):
    """Sessions the user may read: admin all, faculty their own assignments, others none."""
    qs = AttendanceSession.objects.select_related(
        "teaching_assignment__subject", "teaching_assignment__section", "updated_by"
    )
    if user.role == Role.ADMIN:
        return qs
    if user.role == Role.FACULTY:
        return qs.filter(teaching_assignment__faculty__user=user)
    return qs.none()


def list_sessions(
    user: User,
    subject_id: int | None = None,
    section_id: int | None = None,
    date_from: dt.date | None = None,
    date_to: dt.date | None = None,
):
    qs = sessions_for(user)
    if subject_id is not None:
        qs = qs.filter(teaching_assignment__subject_id=subject_id)
    if section_id is not None:
        qs = qs.filter(teaching_assignment__section_id=section_id)
    if date_from is not None:
        qs = qs.filter(date__gte=date_from)
    if date_to is not None:
        qs = qs.filter(date__lte=date_to)
    return _with_counts(qs).order_by("-date", "period", "id")


def _detail_queryset(qs):
    records = AttendanceRecord.objects.select_related("student__user", "updated_by").order_by(
        "student__roll_no"
    )
    return _with_counts(qs).prefetch_related(Prefetch("records", queryset=records))


def get_session_detail(user: User, session_id: int) -> AttendanceSession:
    session = _detail_queryset(sessions_for(user)).filter(pk=session_id).first()
    if session is None:
        raise HttpError(404, "Attendance session not found")
    return session


# ---------------------------------------------------------------- permissions


def _can_write(user: User, assignment: TeachingAssignment) -> bool:
    if user.role == Role.ADMIN:
        return True
    return user.role == Role.FACULTY and assignment.faculty.user_id == user.id


def _assert_can_write(user: User, assignment: TeachingAssignment) -> None:
    if not _can_write(user, assignment):
        raise PermissionDenied("Only the assigned faculty or an admin can modify this class's attendance")


# ---------------------------------------------------------------- writes


def create_session(
    user: User, assignment_id: int, date: dt.date, period: int, topic: str = ""
) -> AttendanceSession:
    assignment = TeachingAssignment.objects.select_related("faculty").filter(pk=assignment_id).first()
    if assignment is None:
        raise HttpError(404, "Teaching assignment not found")
    _assert_can_write(user, assignment)
    if date > timezone.localdate():
        raise HttpError(422, "Attendance cannot be recorded for a future date")

    now = timezone.now()
    try:
        with transaction.atomic():
            session = AttendanceSession.objects.create(
                teaching_assignment=assignment,
                date=date,
                period=period,
                topic=topic,
                created_by=user,
                created_at=now,
                updated_at=now,
            )
            student_ids = StudentProfile.objects.filter(
                section_id=assignment.section_id,
                enrollments__subject_id=assignment.subject_id,
            ).values_list("id", flat=True)
            AttendanceRecord.objects.bulk_create(
                AttendanceRecord(
                    session=session,
                    student_id=sid,
                    status=AttendanceStatus.PRESENT,
                    updated_by=user,
                    updated_at=now,
                )
                for sid in student_ids
            )
    except IntegrityError as exc:
        raise HttpError(409, "A session already exists for this class, date and period") from exc
    return get_session_detail(user, session.pk)


def update_records(user: User, session_id: int, items: list[dict]) -> AttendanceSession:
    session = (
        AttendanceSession.objects.select_related("teaching_assignment__faculty").filter(pk=session_id).first()
    )
    if session is None:
        raise HttpError(404, "Attendance session not found")
    _assert_can_write(user, session.teaching_assignment)

    student_ids = [item["student_id"] for item in items]
    if len(set(student_ids)) != len(student_ids):
        raise HttpError(422, "Duplicate student in records")

    now = timezone.now()
    with transaction.atomic():
        existing = {
            r.student_id: r
            for r in AttendanceRecord.objects.select_for_update().filter(
                session=session, student_id__in=student_ids
            )
        }
        unknown = sorted(set(student_ids) - set(existing))
        if unknown:
            raise HttpError(422, f"Students not part of this session: {unknown}")

        changed, logs = [], []
        for item in items:
            record = existing[item["student_id"]]
            new_status = AttendanceStatus(item["status"])
            if record.status == new_status:
                continue
            logs.append(
                AttendanceAuditLog(
                    record=record,
                    session=session,
                    student_id=record.student_id,
                    old_status=record.status,
                    new_status=new_status,
                    changed_by=user,
                    changed_at=now,
                )
            )
            record.status = new_status
            record.updated_by = user
            record.updated_at = now
            changed.append(record)

        if changed:
            AttendanceRecord.objects.bulk_update(changed, ["status", "updated_by", "updated_at"])
            AttendanceAuditLog.objects.bulk_create(logs)
            session.updated_by = user
            session.updated_at = now
            session.save(update_fields=["updated_by", "updated_at"])
    return get_session_detail(user, session.pk)
