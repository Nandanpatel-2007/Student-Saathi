from ninja import Query, Router, Schema, Status
from ninja.pagination import paginate

from api.auth import admin_only, jwt_auth, require_role
from api.errors import ErrorOut
from api.pagination import StandardPagination
from apps.accounts.models import Role

from . import services
from .schemas import (
    BulkEnrollIn,
    BulkEnrollOut,
    EnrollmentIn,
    EnrollmentOut,
    FacultyClassOut,
    SectionIn,
    SectionOut,
    SubjectIn,
    SubjectOut,
    TeachingAssignmentIn,
    TeachingAssignmentOut,
)

ERRORS = {401: ErrorOut, 403: ErrorOut, 404: ErrorOut}
WRITE_ERRORS = {**ERRORS, 409: ErrorOut, 422: ErrorOut}

admin_or_student = require_role(Role.ADMIN, Role.STUDENT)
admin_or_faculty = require_role(Role.ADMIN, Role.FACULTY)

# ------------------------------------------------------------------ subjects

subjects_router = Router(tags=["Subjects"])


class SubjectFilters(Schema):
    semester: int | None = None
    search: str | None = None


@subjects_router.get(
    "",
    auth=jwt_auth,
    response=list[SubjectOut],
    summary="List subjects (admin: all; faculty: taught; student: enrolled)",
    operation_id="subjects_list",
)
@paginate(StandardPagination)
def list_subjects(request, filters: Query[SubjectFilters]):
    return services.list_subjects(request.user, filters.semester, filters.search)


@subjects_router.get(
    "/{subject_id}",
    auth=jwt_auth,
    response={200: SubjectOut, **ERRORS},
    summary="Get a subject",
    operation_id="subjects_get",
)
def get_subject(request, subject_id: int):
    return services.get_subject(request.user, subject_id)


@subjects_router.post(
    "",
    auth=admin_only,
    response={201: SubjectOut, **WRITE_ERRORS},
    summary="Create a subject (admin)",
    operation_id="subjects_create",
)
def create_subject(request, payload: SubjectIn):
    return Status(201, services.create_subject(payload.dict()))


@subjects_router.put(
    "/{subject_id}",
    auth=admin_only,
    response={200: SubjectOut, **WRITE_ERRORS},
    summary="Replace a subject (admin)",
    operation_id="subjects_update",
)
def update_subject(request, subject_id: int, payload: SubjectIn):
    return services.update_subject(subject_id, payload.dict())


@subjects_router.delete(
    "/{subject_id}",
    auth=admin_only,
    response={204: None, **WRITE_ERRORS},
    summary="Delete a subject (admin)",
    operation_id="subjects_delete",
)
def delete_subject(request, subject_id: int):
    services.delete_subject(subject_id)
    return Status(204, None)


# ------------------------------------------------------------------ sections

sections_router = Router(tags=["Sections"])


class SectionFilters(Schema):
    semester: int | None = None
    academic_year: str | None = None
    search: str | None = None


@sections_router.get(
    "",
    auth=jwt_auth,
    response=list[SectionOut],
    summary="List sections (admin: all; faculty: taught; student: own)",
    operation_id="sections_list",
)
@paginate(StandardPagination)
def list_sections(request, filters: Query[SectionFilters]):
    return services.list_sections(request.user, filters.semester, filters.academic_year, filters.search)


@sections_router.get(
    "/{section_id}",
    auth=jwt_auth,
    response={200: SectionOut, **ERRORS},
    summary="Get a section",
    operation_id="sections_get",
)
def get_section(request, section_id: int):
    return services.get_section(request.user, section_id)


@sections_router.post(
    "",
    auth=admin_only,
    response={201: SectionOut, **WRITE_ERRORS},
    summary="Create a section (admin)",
    operation_id="sections_create",
)
def create_section(request, payload: SectionIn):
    return Status(201, services.create_section(payload.dict()))


@sections_router.put(
    "/{section_id}",
    auth=admin_only,
    response={200: SectionOut, **WRITE_ERRORS},
    summary="Replace a section (admin)",
    operation_id="sections_update",
)
def update_section(request, section_id: int, payload: SectionIn):
    return services.update_section(section_id, payload.dict())


@sections_router.delete(
    "/{section_id}",
    auth=admin_only,
    response={204: None, **WRITE_ERRORS},
    summary="Delete a section (admin)",
    operation_id="sections_delete",
)
def delete_section(request, section_id: int):
    services.delete_section(section_id)
    return Status(204, None)


# ------------------------------------------------------------------ enrollments

enrollments_router = Router(tags=["Enrollments"])


class EnrollmentFilters(Schema):
    subject_id: int | None = None
    section_id: int | None = None
    student_id: int | None = None


@enrollments_router.get(
    "",
    auth=admin_or_student,
    response=list[EnrollmentOut],
    summary="List enrollments (admin: all; student: own)",
    operation_id="enrollments_list",
)
@paginate(StandardPagination)
def list_enrollments(request, filters: Query[EnrollmentFilters]):
    return services.list_enrollments(request.user, filters.subject_id, filters.section_id, filters.student_id)


@enrollments_router.post(
    "/bulk",
    auth=admin_only,
    response={200: BulkEnrollOut, **WRITE_ERRORS},
    summary="Enroll a whole section into a subject (admin, idempotent)",
    operation_id="enrollments_bulk_create",
)
def bulk_enroll(request, payload: BulkEnrollIn):
    return services.bulk_enroll_section(payload.section_id, payload.subject_id)


@enrollments_router.get(
    "/{enrollment_id}",
    auth=admin_or_student,
    response={200: EnrollmentOut, **ERRORS},
    summary="Get an enrollment",
    operation_id="enrollments_get",
)
def get_enrollment(request, enrollment_id: int):
    return services.get_enrollment(request.user, enrollment_id)


@enrollments_router.post(
    "",
    auth=admin_only,
    response={201: EnrollmentOut, **WRITE_ERRORS},
    summary="Enroll one student in a subject (admin)",
    operation_id="enrollments_create",
)
def create_enrollment(request, payload: EnrollmentIn):
    return Status(201, services.create_enrollment(payload.student_id, payload.subject_id))


@enrollments_router.delete(
    "/{enrollment_id}",
    auth=admin_only,
    response={204: None, **WRITE_ERRORS},
    summary="Remove an enrollment (admin)",
    operation_id="enrollments_delete",
)
def delete_enrollment(request, enrollment_id: int):
    services.delete_enrollment(enrollment_id)
    return Status(204, None)


# ------------------------------------------------------------------ teaching assignments

assignments_router = Router(tags=["Teaching assignments"])


class AssignmentFilters(Schema):
    faculty_id: int | None = None
    subject_id: int | None = None
    section_id: int | None = None


@assignments_router.get(
    "",
    auth=admin_or_faculty,
    response=list[TeachingAssignmentOut],
    summary="List teaching assignments (admin: all; faculty: own)",
    operation_id="teaching_assignments_list",
)
@paginate(StandardPagination)
def list_assignments(request, filters: Query[AssignmentFilters]):
    return services.list_assignments(request.user, filters.faculty_id, filters.subject_id, filters.section_id)


@assignments_router.get(
    "/{assignment_id}",
    auth=admin_or_faculty,
    response={200: TeachingAssignmentOut, **ERRORS},
    summary="Get a teaching assignment",
    operation_id="teaching_assignments_get",
)
def get_assignment(request, assignment_id: int):
    return services.get_assignment(request.user, assignment_id)


@assignments_router.post(
    "",
    auth=admin_only,
    response={201: TeachingAssignmentOut, **WRITE_ERRORS},
    summary="Assign a faculty member to a subject and section (admin)",
    operation_id="teaching_assignments_create",
)
def create_assignment(request, payload: TeachingAssignmentIn):
    return Status(201, services.create_assignment(payload.dict()))


@assignments_router.put(
    "/{assignment_id}",
    auth=admin_only,
    response={200: TeachingAssignmentOut, **WRITE_ERRORS},
    summary="Replace a teaching assignment (admin)",
    operation_id="teaching_assignments_update",
)
def update_assignment(request, assignment_id: int, payload: TeachingAssignmentIn):
    return services.update_assignment(assignment_id, payload.dict())


@assignments_router.delete(
    "/{assignment_id}",
    auth=admin_only,
    response={204: None, **WRITE_ERRORS},
    summary="Delete a teaching assignment (admin)",
    operation_id="teaching_assignments_delete",
)
def delete_assignment(request, assignment_id: int):
    services.delete_assignment(assignment_id)
    return Status(204, None)


# ------------------------------------------------------------------ faculty

faculty_router = Router(tags=["Faculty"])


@faculty_router.get(
    "/me/classes",
    auth=require_role(Role.FACULTY),
    response=list[FacultyClassOut],
    summary="Subject+section pairs the logged-in faculty teaches",
    operation_id="faculty_my_classes",
)
@paginate(StandardPagination)
def my_classes(request):
    return services.faculty_classes(request.user)
