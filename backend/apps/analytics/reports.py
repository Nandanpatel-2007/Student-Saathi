"""Loads data (a fixed number of queries per endpoint) and feeds it through services.py."""

import csv
import io
from collections import defaultdict
from dataclasses import dataclass

from django.db.models import Count
from django.db.models.functions import TruncMonth
from ninja.errors import HttpError

from apps.academics.models import Subject, TeachingAssignment
from apps.accounts.models import Role, StudentProfile, User
from apps.assessments.models import Assessment, Mark
from apps.attendance.models import AttendanceRecord, AttendanceSession

from . import services as svc

MARK_FIELDS = (
    "student_id",
    "assessment_id",
    "assessment__date",
    "assessment__max_marks",
    "marks_obtained",
    "is_absent",
)


def _r(value: float | None) -> float | None:
    return None if value is None else round(value, 2)


def _alert_dict(alert: svc.Alert, subject=None) -> dict:
    return {
        "code": alert.code,
        "severity": alert.severity,
        "message": alert.message,
        "subject_id": subject.id if subject else None,
        "subject_code": subject.code if subject else None,
    }


def _entries_by_student(rows) -> dict[int, list[svc.MarkEntry]]:
    result: dict[int, list[svc.MarkEntry]] = defaultdict(list)
    for row in rows:
        result[row["student_id"]].append(
            svc.MarkEntry(
                item_id=row["assessment_id"],
                date=row["assessment__date"],
                max_marks=float(row["assessment__max_marks"]),
                marks_obtained=None if row["marks_obtained"] is None else float(row["marks_obtained"]),
                is_absent=row["is_absent"],
            )
        )
    return result


def _counts_by_key(rows, key: str) -> dict:
    grouped: dict = defaultdict(lambda: defaultdict(int))
    for row in rows:
        grouped[row[key]][row["status"]] += row["n"]
    return {k: svc.AttendanceCounts.from_status_counts(v) for k, v in grouped.items()}


# ---------------------------------------------------------------- student dashboard


def student_dashboard(user: User) -> dict:
    cfg = svc.AnalyticsConfig.from_settings()
    student = StudentProfile.objects.filter(user=user).first()
    if student is None:
        raise HttpError(404, "Student profile not found")

    subjects = list(Subject.objects.filter(enrollments__student=student).order_by("code"))
    subject_ids = [s.id for s in subjects]
    assignment_subject = dict(
        TeachingAssignment.objects.filter(
            section_id=student.section_id, subject_id__in=subject_ids
        ).values_list("id", "subject_id")
    )

    # The student's own attendance, per subject and per month.
    own_records = AttendanceRecord.objects.filter(student=student)
    own_rows = own_records.values("session__teaching_assignment__subject_id", "status").annotate(
        n=Count("id")
    )
    own_counts = _counts_by_key(
        [{**r, "subject_id": r["session__teaching_assignment__subject_id"]} for r in own_rows],
        "subject_id",
    )
    trend_rows = [
        (r["month"].strftime("%Y-%m"), r["status"], r["n"])
        for r in own_records.annotate(month=TruncMonth("session__date"))
        .values("month", "status")
        .annotate(n=Count("id"))
    ]

    # Everyone in the same classes, to work out the class averages (only aggregates are returned).
    class_rows = (
        AttendanceRecord.objects.filter(session__teaching_assignment_id__in=assignment_subject)
        .values("session__teaching_assignment__subject_id", "student_id", "status")
        .annotate(n=Count("id"))
    )
    pair_counts: dict[tuple[int, int], dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for row in class_rows:
        pair_counts[(row["session__teaching_assignment__subject_id"], row["student_id"])][row["status"]] += (
            row["n"]
        )
    attendance_by_subject: dict[int, list[float | None]] = defaultdict(list)
    for (subject_id, _student_id), by_status in pair_counts.items():
        counts = svc.AttendanceCounts.from_status_counts(by_status)
        attendance_by_subject[subject_id].append(svc.attendance_percentage(counts, cfg))

    mark_rows = list(
        Mark.objects.filter(assessment__teaching_assignment_id__in=assignment_subject).values(
            *MARK_FIELDS, "assessment__teaching_assignment_id"
        )
    )
    per_subject: dict[int, list[dict]] = defaultdict(list)
    for row in mark_rows:
        per_subject[assignment_subject[row["assessment__teaching_assignment_id"]]].append(row)

    subject_payloads, all_alerts = [], []
    overall = svc.AttendanceCounts()
    for subject in subjects:
        entries_by_student = _entries_by_student(per_subject[subject.id])
        class_scores = [svc.average_score(entries) for entries in entries_by_student.values()]
        counts = own_counts.get(subject.id, svc.AttendanceCounts())
        metrics = svc.subject_metrics(counts, entries_by_student.get(student.id, []), cfg)
        overall += counts
        alerts = [_alert_dict(a, subject) for a in metrics.alerts]
        all_alerts.extend(alerts)
        subject_payloads.append(
            {
                "subject": subject,
                "present": counts.present,
                "absent": counts.absent,
                "late": counts.late,
                "excused": counts.excused,
                "classes_held": counts.total,
                "attendance_pct": _r(metrics.attendance_pct),
                "class_avg_attendance_pct": _r(svc.class_average(attendance_by_subject.get(subject.id, []))),
                "classes_needed_for_threshold": metrics.classes_needed,
                "average_score_pct": _r(metrics.average_score),
                "class_avg_score_pct": _r(svc.class_average(class_scores)),
                "alerts": alerts,
            }
        )

    return {
        "attendance_overall": _r(svc.attendance_percentage(overall, cfg)),
        "average_score_overall": _r(svc.class_average(p["average_score_pct"] for p in subject_payloads)),
        "subjects": subject_payloads,
        "alerts": all_alerts,
        "trend": [
            {**p, "attendance_pct": _r(p["attendance_pct"])} for p in svc.monthly_trend(trend_rows, cfg)
        ],
    }


# ---------------------------------------------------------------- faculty class views


@dataclass
class StudentRow:
    student: StudentProfile
    metrics: svc.SubjectMetrics
    diff_attendance: float | None
    diff_score: float | None


@dataclass
class ClassData:
    assignment: TeachingAssignment
    rows: list[StudentRow]
    sessions_held: int
    entries: dict[int, list[svc.MarkEntry]]
    class_attendance_pct: float | None
    class_score_pct: float | None
    cfg: svc.AnalyticsConfig


def load_class(user: User, assignment_id: int) -> ClassData:
    cfg = svc.AnalyticsConfig.from_settings()
    qs = TeachingAssignment.objects.select_related("subject", "section")
    if user.role == Role.FACULTY:
        qs = qs.filter(faculty__user=user)
    elif user.role != Role.ADMIN:
        qs = qs.none()
    assignment = qs.filter(pk=assignment_id).first()
    if assignment is None:
        raise HttpError(404, "Class not found")

    roster = list(
        StudentProfile.objects.filter(
            section_id=assignment.section_id, enrollments__subject_id=assignment.subject_id
        )
        .select_related("user")
        .order_by("roll_no")
    )
    counts = _counts_by_key(
        AttendanceRecord.objects.filter(session__teaching_assignment=assignment)
        .values("student_id", "status")
        .annotate(n=Count("id")),
        "student_id",
    )
    entries = _entries_by_student(
        Mark.objects.filter(assessment__teaching_assignment=assignment).values(*MARK_FIELDS)
    )
    sessions_held = AttendanceSession.objects.filter(teaching_assignment=assignment).count()

    metrics = {
        s.id: svc.subject_metrics(counts.get(s.id, svc.AttendanceCounts()), entries.get(s.id, []), cfg)
        for s in roster
    }
    class_attendance = svc.class_average(m.attendance_pct for m in metrics.values())
    class_score = svc.class_average(m.average_score for m in metrics.values())
    rows = [
        StudentRow(
            student=s,
            metrics=metrics[s.id],
            diff_attendance=svc.diff_points(metrics[s.id].attendance_pct, class_attendance),
            diff_score=svc.diff_points(metrics[s.id].average_score, class_score),
        )
        for s in roster
    ]
    return ClassData(assignment, rows, sessions_held, entries, class_attendance, class_score, cfg)


def class_summary(user: User, assignment_id: int) -> dict:
    data = load_class(user, assignment_id)
    scores = [row.metrics.average_score for row in data.rows]
    at_risk = sorted(
        (row for row in data.rows if svc.is_at_risk(row.metrics.alerts)),
        key=lambda row: (-len(row.metrics.alerts), row.student.roll_no),
    )
    return {
        "assignment_id": data.assignment.id,
        "subject": data.assignment.subject,
        "section": data.assignment.section,
        "students": len(data.rows),
        "sessions_held": data.sessions_held,
        "attendance_pct": _r(data.class_attendance_pct),
        "average_score_pct": _r(data.class_score_pct),
        "marks_distribution": svc.histogram(scores),
        "at_risk_students": [
            {
                "student": row.student,
                "attendance_pct": _r(row.metrics.attendance_pct),
                "average_score_pct": _r(row.metrics.average_score),
                "alerts": [_alert_dict(a) for a in row.metrics.alerts],
            }
            for row in at_risk
        ],
    }


def class_students(user: User, assignment_id: int) -> list[dict]:
    data = load_class(user, assignment_id)
    return [
        {
            "student": row.student,
            "present": row.metrics.counts.present,
            "absent": row.metrics.counts.absent,
            "late": row.metrics.counts.late,
            "excused": row.metrics.counts.excused,
            "attendance_pct": _r(row.metrics.attendance_pct),
            "average_score_pct": _r(row.metrics.average_score),
            "diff_from_class_attendance": _r(row.diff_attendance),
            "diff_from_class_score": _r(row.diff_score),
            "classes_needed_for_threshold": row.metrics.classes_needed,
            "alerts": [_alert_dict(a) for a in row.metrics.alerts],
        }
        for row in data.rows
    ]


# ---------------------------------------------------------------- CSV export

_STATUS_LETTER = {"PRESENT": "P", "ABSENT": "A", "LATE": "L", "EXCUSED": "E"}


def _safe(cell):
    """Neutralise spreadsheet formula injection in user-supplied text."""
    if isinstance(cell, str) and cell[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + cell
    return cell


def export_class_csv(user: User, assignment_id: int, kind: str) -> tuple[str, str]:
    data = load_class(user, assignment_id)
    out = io.StringIO()
    writer = csv.writer(out)

    def write(row):
        writer.writerow([_safe(c) for c in row])

    base = ["Roll No", "Name"]
    if kind == "attendance":
        sessions = list(
            AttendanceSession.objects.filter(teaching_assignment=data.assignment).order_by(
                "date", "period", "id"
            )
        )
        statuses = {
            (r["student_id"], r["session_id"]): r["status"]
            for r in AttendanceRecord.objects.filter(session__teaching_assignment=data.assignment).values(
                "student_id", "session_id", "status"
            )
        }
        write(
            base
            + [f"{s.date.isoformat()} P{s.period}" for s in sessions]
            + ["Present", "Late", "Absent", "Excused", "Attendance %", "Diff vs class (pts)"]
        )
        for row in data.rows:
            c = row.metrics.counts
            write(
                [row.student.roll_no, row.student.user.display_name]
                + [_STATUS_LETTER.get(statuses.get((row.student.id, s.id)), "") for s in sessions]
                + [
                    c.present,
                    c.late,
                    c.absent,
                    c.excused,
                    _r(row.metrics.attendance_pct),
                    _r(row.diff_attendance),
                ]
            )
    else:
        assessments = list(
            Assessment.objects.filter(teaching_assignment=data.assignment).order_by("date", "id")
        )
        write(
            base
            + [f"{a.title} (/{float(a.max_marks):g})" for a in assessments]
            + ["Average score %", "Diff vs class (pts)"]
        )
        for row in data.rows:
            by_assessment = {e.item_id: e for e in data.entries.get(row.student.id, [])}
            cells = []
            for a in assessments:
                entry = by_assessment.get(a.id)
                if entry is None or not entry.is_graded:
                    cells.append("")
                elif entry.is_absent:
                    cells.append("AB")
                else:
                    cells.append(f"{entry.marks_obtained:g}")
            write(
                [row.student.roll_no, row.student.user.display_name]
                + cells
                + [_r(row.metrics.average_score), _r(row.diff_score)]
            )

    name = f"{data.assignment.subject.code}-{data.assignment.section.name}-{kind}.csv".replace(" ", "_")
    return name, out.getvalue()
