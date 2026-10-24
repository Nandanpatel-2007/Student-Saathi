"""Admin-only lookups and counts (the admin portal's selects and overview)."""

from django.db.models import Q

from apps.academics.models import Enrollment, Section, Subject, TeachingAssignment

from .models import FacultyProfile, StudentProfile


def overview() -> dict:
    return {
        "students": StudentProfile.objects.count(),
        "faculty": FacultyProfile.objects.count(),
        "subjects": Subject.objects.count(),
        "sections": Section.objects.count(),
        "teaching_assignments": TeachingAssignment.objects.count(),
        "enrollments": Enrollment.objects.count(),
    }


def _name_search(qs, search: str, *fields: str):
    return qs.filter(
        Q(user__first_name__icontains=search)
        | Q(user__last_name__icontains=search)
        | Q(user__username__icontains=search)
        | Q(**{f"{fields[0]}__icontains": search})
    )


def list_faculty(search: str | None = None):
    qs = FacultyProfile.objects.select_related("user", "department").order_by("employee_id")
    return _name_search(qs, search, "employee_id") if search else qs


def list_students(search: str | None = None, section_id: int | None = None):
    qs = StudentProfile.objects.select_related("user", "section").order_by("roll_no")
    if section_id is not None:
        qs = qs.filter(section_id=section_id)
    return _name_search(qs, search, "roll_no") if search else qs
