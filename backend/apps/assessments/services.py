"""Assessment and marks business logic."""

import datetime as dt

from django.core.exceptions import PermissionDenied
from django.db import transaction
from ninja.errors import HttpError

from api.errors import DetailedHttpError
from apps.academics.models import TeachingAssignment
from apps.accounts.models import Role, StudentProfile, User

from .models import Assessment, Mark

# ---------------------------------------------------------------- scoping / permissions


def _base_queryset():
    return Assessment.objects.select_related("teaching_assignment__subject", "teaching_assignment__section")


def assessments_for(user: User):
    """Admin: all. Faculty: own assignments. Student: assessments of classes they belong to."""
    qs = _base_queryset()
    if user.role == Role.ADMIN:
        return qs
    if user.role == Role.FACULTY:
        return qs.filter(teaching_assignment__faculty__user=user)
    return qs.filter(
        teaching_assignment__section__students__user=user,
        teaching_assignment__subject__enrollments__student__user=user,
    )


def _assert_can_write(user: User, assignment: TeachingAssignment) -> None:
    if user.role == Role.ADMIN:
        return
    if user.role == Role.FACULTY and assignment.faculty.user_id == user.id:
        return
    raise PermissionDenied("Only the assigned faculty or an admin can modify this class's assessments")


def _get_assignment(assignment_id: int) -> TeachingAssignment:
    assignment = TeachingAssignment.objects.select_related("faculty").filter(pk=assignment_id).first()
    if assignment is None:
        raise HttpError(404, "Teaching assignment not found")
    return assignment


def _get_writable_assessment(user: User, assessment_id: int) -> Assessment:
    assessment = (
        Assessment.objects.select_related("teaching_assignment__faculty").filter(pk=assessment_id).first()
    )
    if assessment is None:
        raise HttpError(404, "Assessment not found")
    _assert_can_write(user, assessment.teaching_assignment)
    return assessment


def _reload(pk: int) -> Assessment:
    return _base_queryset().get(pk=pk)


# ---------------------------------------------------------------- assessments


def list_assessments(
    user: User,
    assignment_id: int | None = None,
    subject_id: int | None = None,
    section_id: int | None = None,
    type: str | None = None,
    date_from: dt.date | None = None,
    date_to: dt.date | None = None,
):
    qs = assessments_for(user)
    if assignment_id is not None:
        qs = qs.filter(teaching_assignment_id=assignment_id)
    if subject_id is not None:
        qs = qs.filter(teaching_assignment__subject_id=subject_id)
    if section_id is not None:
        qs = qs.filter(teaching_assignment__section_id=section_id)
    if type:
        qs = qs.filter(type=type)
    if date_from is not None:
        qs = qs.filter(date__gte=date_from)
    if date_to is not None:
        qs = qs.filter(date__lte=date_to)
    return qs.order_by("date", "id")


def get_assessment(user: User, assessment_id: int) -> Assessment:
    assessment = assessments_for(user).filter(pk=assessment_id).first()
    if assessment is None:
        raise HttpError(404, "Assessment not found")
    return assessment


def create_assessment(user: User, data: dict) -> Assessment:
    assignment = _get_assignment(data.pop("teaching_assignment_id"))
    _assert_can_write(user, assignment)
    assessment = Assessment.objects.create(teaching_assignment=assignment, **data)
    return _reload(assessment.pk)


def update_assessment(user: User, assessment_id: int, data: dict) -> Assessment:
    assessment = _get_writable_assessment(user, assessment_id)
    with transaction.atomic():
        if Mark.objects.filter(assessment=assessment, marks_obtained__gt=data["max_marks"]).exists():
            raise DetailedHttpError(
                422,
                "Existing marks exceed the new maximum",
                [{"field": "max_marks", "message": "Some recorded marks are higher than this maximum"}],
            )
        for key, value in data.items():
            setattr(assessment, key, value)
        assessment.save()
    return _reload(assessment.pk)


def delete_assessment(user: User, assessment_id: int) -> None:
    _get_writable_assessment(user, assessment_id).delete()


# ---------------------------------------------------------------- marks


def _roster(assignment: TeachingAssignment):
    """Students graded in this class: in the section and enrolled in the subject."""
    return (
        StudentProfile.objects.filter(
            section_id=assignment.section_id, enrollments__subject_id=assignment.subject_id
        )
        .select_related("user")
        .order_by("roll_no")
    )


def _sheet(assessment: Assessment, students) -> dict:
    marks = {m.student_id: m for m in Mark.objects.filter(assessment=assessment)}
    rows = []
    for student in students:
        mark = marks.get(student.id)
        rows.append(
            {
                "student": student,
                "marks_obtained": mark.marks_obtained if mark else None,
                "is_absent": mark.is_absent if mark else False,
            }
        )
    return {"assessment": assessment, "marks": rows}


def get_marks_sheet(user: User, assessment_id: int) -> dict:
    """Staff see the whole roster; a student sees only their own row."""
    assessment = get_assessment(user, assessment_id)
    students = _roster(assessment.teaching_assignment)
    if user.role == Role.STUDENT:
        students = students.filter(user=user)
    return _sheet(assessment, students)


def update_marks(user: User, assessment_id: int, items: list[dict]) -> dict:
    assessment = _get_writable_assessment(user, assessment_id)
    assignment = assessment.teaching_assignment
    roster = {s.id: s for s in _roster(assignment)}

    errors = []
    seen = set()
    for i, item in enumerate(items):
        sid = item["student_id"]
        field = f"marks.{i}"
        if sid in seen:
            errors.append({"field": f"{field}.student_id", "message": "Duplicate student"})
        seen.add(sid)
        if sid not in roster:
            errors.append({"field": f"{field}.student_id", "message": "Student is not part of this class"})
        obtained = item["marks_obtained"]
        if item["is_absent"] and obtained is not None:
            errors.append(
                {"field": f"{field}.marks_obtained", "message": "Marks must be empty for an absent student"}
            )
        elif obtained is not None and obtained > assessment.max_marks:
            errors.append(
                {
                    "field": f"{field}.marks_obtained",
                    "message": f"Marks cannot exceed the maximum of {assessment.max_marks}",
                }
            )
    if errors:
        raise DetailedHttpError(422, "Marks validation failed", errors)

    with transaction.atomic():
        existing = {
            m.student_id: m
            for m in Mark.objects.select_for_update().filter(assessment=assessment, student_id__in=seen)
        }
        to_create, to_update = [], []
        for item in items:
            mark = existing.get(item["student_id"])
            if mark is None:
                to_create.append(
                    Mark(
                        assessment=assessment,
                        student_id=item["student_id"],
                        marks_obtained=item["marks_obtained"],
                        is_absent=item["is_absent"],
                    )
                )
            else:
                mark.marks_obtained = item["marks_obtained"]
                mark.is_absent = item["is_absent"]
                to_update.append(mark)
        Mark.objects.bulk_create(to_create)
        Mark.objects.bulk_update(to_update, ["marks_obtained", "is_absent"])

    return _sheet(_reload(assessment.pk), roster.values())
