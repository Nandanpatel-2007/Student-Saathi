"""Academics business logic: role-scoped querysets and write operations."""

from django.db import IntegrityError, transaction
from django.db.models import ProtectedError, Q, QuerySet
from ninja.errors import HttpError

from apps.accounts.models import FacultyProfile, Role, StudentProfile, User

from .models import Enrollment, Section, Subject, TeachingAssignment

# ---------------------------------------------------------------- helpers


def _get_or_404(source, pk: int, label: str):
    """`source` is a model class or an already-scoped queryset."""
    qs = source if isinstance(source, QuerySet) else source.objects.all()
    obj = qs.filter(pk=pk).first()
    if obj is None:
        raise HttpError(404, f"{label} not found")
    return obj


def _save(obj, conflict_message: str):
    try:
        with transaction.atomic():
            obj.save()
    except IntegrityError as exc:
        raise HttpError(409, conflict_message) from exc
    return obj


def delete_object(obj, in_use_message: str) -> None:
    try:
        obj.delete()
    except ProtectedError as exc:
        raise HttpError(409, in_use_message) from exc


# ---------------------------------------------------------------- scoping


def subjects_for(user: User) -> QuerySet[Subject]:
    qs = Subject.objects.all()
    if user.role == Role.FACULTY:
        return qs.filter(teaching_assignments__faculty__user=user).distinct()
    if user.role == Role.STUDENT:
        return qs.filter(enrollments__student__user=user).distinct()
    return qs


def sections_for(user: User) -> QuerySet[Section]:
    qs = Section.objects.all()
    if user.role == Role.FACULTY:
        return qs.filter(teaching_assignments__faculty__user=user).distinct()
    if user.role == Role.STUDENT:
        return qs.filter(students__user=user).distinct()
    return qs


def enrollments_for(user: User) -> QuerySet[Enrollment]:
    qs = Enrollment.objects.select_related("student__user", "subject")
    if user.role == Role.ADMIN:
        return qs
    return qs.filter(student__user=user)


def assignments_for(user: User) -> QuerySet[TeachingAssignment]:
    qs = TeachingAssignment.objects.select_related("faculty__user", "subject", "section")
    if user.role == Role.ADMIN:
        return qs
    return qs.filter(faculty__user=user)


# ---------------------------------------------------------------- subjects


def list_subjects(user: User, semester: int | None = None, search: str | None = None):
    qs = subjects_for(user)
    if semester is not None:
        qs = qs.filter(semester=semester)
    if search:
        qs = qs.filter(Q(code__icontains=search) | Q(name__icontains=search))
    return qs


def get_subject(user: User, subject_id: int) -> Subject:
    return _get_or_404(subjects_for(user), subject_id, "Subject")


def create_subject(data: dict) -> Subject:
    return _save(Subject(**data), "A subject with this code already exists")


def update_subject(subject_id: int, data: dict) -> Subject:
    subject = _get_or_404(Subject, subject_id, "Subject")
    for key, value in data.items():
        setattr(subject, key, value)
    return _save(subject, "A subject with this code already exists")


def delete_subject(subject_id: int) -> None:
    delete_object(
        _get_or_404(Subject, subject_id, "Subject"),
        "Subject is in use by enrollments or teaching assignments",
    )


# ---------------------------------------------------------------- sections


def list_sections(
    user: User,
    semester: int | None = None,
    academic_year: str | None = None,
    search: str | None = None,
):
    qs = sections_for(user)
    if semester is not None:
        qs = qs.filter(semester=semester)
    if academic_year:
        qs = qs.filter(academic_year=academic_year)
    if search:
        qs = qs.filter(Q(name__icontains=search) | Q(program__icontains=search))
    return qs


def get_section(user: User, section_id: int) -> Section:
    return _get_or_404(sections_for(user), section_id, "Section")


def create_section(data: dict) -> Section:
    return _save(Section(**data), "This section already exists")


def update_section(section_id: int, data: dict) -> Section:
    section = _get_or_404(Section, section_id, "Section")
    for key, value in data.items():
        setattr(section, key, value)
    return _save(section, "This section already exists")


def delete_section(section_id: int) -> None:
    delete_object(
        _get_or_404(Section, section_id, "Section"),
        "Section still has students or teaching assignments",
    )


# ---------------------------------------------------------------- enrollments


def list_enrollments(
    user: User,
    subject_id: int | None = None,
    section_id: int | None = None,
    student_id: int | None = None,
):
    qs = enrollments_for(user)
    if subject_id is not None:
        qs = qs.filter(subject_id=subject_id)
    if section_id is not None:
        qs = qs.filter(student__section_id=section_id)
    if student_id is not None:
        qs = qs.filter(student_id=student_id)
    return qs


def get_enrollment(user: User, enrollment_id: int) -> Enrollment:
    return _get_or_404(enrollments_for(user), enrollment_id, "Enrollment")


def create_enrollment(student_id: int, subject_id: int) -> Enrollment:
    student = _get_or_404(StudentProfile, student_id, "Student")
    subject = _get_or_404(Subject, subject_id, "Subject")
    enrollment = _save(
        Enrollment(student=student, subject=subject), "Student is already enrolled in this subject"
    )
    return Enrollment.objects.select_related("student__user", "subject").get(pk=enrollment.pk)


def delete_enrollment(enrollment_id: int) -> None:
    _get_or_404(Enrollment, enrollment_id, "Enrollment").delete()


def bulk_enroll_section(section_id: int, subject_id: int) -> dict:
    """Enroll every student of a section into a subject. Idempotent."""
    section = _get_or_404(Section, section_id, "Section")
    subject = _get_or_404(Subject, subject_id, "Subject")
    with transaction.atomic():
        student_ids = list(StudentProfile.objects.filter(section=section).values_list("id", flat=True))
        existing = set(
            Enrollment.objects.filter(subject=subject, student_id__in=student_ids).values_list(
                "student_id", flat=True
            )
        )
        new = [Enrollment(student_id=sid, subject=subject) for sid in student_ids if sid not in existing]
        Enrollment.objects.bulk_create(new, ignore_conflicts=True)
    return {
        "section_id": section.id,
        "subject_id": subject.id,
        "enrolled": len(new),
        "already_enrolled": len(existing),
    }


# ---------------------------------------------------------------- teaching assignments


def list_assignments(
    user: User,
    faculty_id: int | None = None,
    subject_id: int | None = None,
    section_id: int | None = None,
):
    qs = assignments_for(user)
    if faculty_id is not None:
        qs = qs.filter(faculty_id=faculty_id)
    if subject_id is not None:
        qs = qs.filter(subject_id=subject_id)
    if section_id is not None:
        qs = qs.filter(section_id=section_id)
    return qs


def get_assignment(user: User, assignment_id: int) -> TeachingAssignment:
    return _get_or_404(assignments_for(user), assignment_id, "Teaching assignment")


def _assignment_refs(data: dict):
    return (
        _get_or_404(FacultyProfile, data["faculty_id"], "Faculty"),
        _get_or_404(Subject, data["subject_id"], "Subject"),
        _get_or_404(Section, data["section_id"], "Section"),
    )


def _reload_assignment(pk: int) -> TeachingAssignment:
    return TeachingAssignment.objects.select_related("faculty__user", "subject", "section").get(pk=pk)


def create_assignment(data: dict) -> TeachingAssignment:
    faculty, subject, section = _assignment_refs(data)
    obj = _save(
        TeachingAssignment(faculty=faculty, subject=subject, section=section),
        "This teaching assignment already exists",
    )
    return _reload_assignment(obj.pk)


def update_assignment(assignment_id: int, data: dict) -> TeachingAssignment:
    obj = _get_or_404(TeachingAssignment, assignment_id, "Teaching assignment")
    obj.faculty, obj.subject, obj.section = _assignment_refs(data)
    _save(obj, "This teaching assignment already exists")
    return _reload_assignment(obj.pk)


def delete_assignment(assignment_id: int) -> None:
    delete_object(
        _get_or_404(TeachingAssignment, assignment_id, "Teaching assignment"),
        "Teaching assignment is in use",
    )


def faculty_classes(user: User):
    """Subject+section pairs the logged-in faculty member teaches."""
    return assignments_for(user).filter(faculty__user=user)
