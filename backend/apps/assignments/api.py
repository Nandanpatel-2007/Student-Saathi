from django.http import FileResponse, HttpResponse
from ninja import File, Form, Query, Router, Schema, Status, UploadedFile
from ninja.pagination import paginate

from api.auth import faculty_or_admin, require_role
from api.errors import ErrorOut
from api.pagination import StandardPagination
from apps.accounts.models import Role

from . import services
from .schemas import (
    AssignmentCreateIn,
    AssignmentOut,
    AssignmentUpdateIn,
    GradeIn,
    StudentAssignmentOut,
    SubmissionRowOut,
)

router = Router(tags=["Assignments"])
student_router = Router(tags=["Assignments"])

ERRORS = {401: ErrorOut, 403: ErrorOut, 404: ErrorOut}
WRITE_ERRORS = {**ERRORS, 409: ErrorOut, 422: ErrorOut}
student_only = require_role(Role.STUDENT)


class AssignmentFilters(Schema):
    teaching_assignment_id: int | None = None


class StatusFilter(Schema):
    status: str | None = None


class StudentFilters(Schema):
    status: str | None = None
    subject: int | None = None


# ------------------------------------------------------------------ faculty / admin: assignments


@router.post(
    "",
    auth=faculty_or_admin,
    response={201: AssignmentOut, **WRITE_ERRORS},
    summary="Post an assignment to a class",
    operation_id="assignments_create",
)
def create_assignment(request, payload: AssignmentCreateIn):
    return Status(201, services.create_assignment(request.user, payload.dict()))


@router.get(
    "",
    auth=faculty_or_admin,
    response=list[AssignmentOut],
    summary="List assignments (admin: all; faculty: own classes)",
    operation_id="assignments_list",
)
@paginate(StandardPagination)
def list_assignments(request, filters: Query[AssignmentFilters]):
    return services.list_assignments(request.user, filters.teaching_assignment_id)


@router.get(
    "/{assignment_id}",
    auth=faculty_or_admin,
    response={200: AssignmentOut, **ERRORS},
    summary="Get an assignment with submission counts",
    operation_id="assignments_get",
)
def get_assignment(request, assignment_id: int):
    return services.get_assignment(request.user, assignment_id)


@router.put(
    "/{assignment_id}",
    auth=faculty_or_admin,
    response={200: AssignmentOut, **WRITE_ERRORS},
    summary="Edit an assignment (timing is re-evaluated against the new due date)",
    operation_id="assignments_update",
)
def update_assignment(request, assignment_id: int, payload: AssignmentUpdateIn):
    return services.update_assignment(request.user, assignment_id, payload.dict())


@router.delete(
    "/{assignment_id}",
    auth=faculty_or_admin,
    response={204: None, **ERRORS},
    summary="Delete an assignment, its submissions and their files",
    operation_id="assignments_delete",
)
def delete_assignment(request, assignment_id: int):
    services.delete_assignment(request.user, assignment_id)
    return Status(204, None)


# ------------------------------------------------------------------ faculty / admin: submissions


@router.get(
    "/{assignment_id}/submissions",
    auth=faculty_or_admin,
    response=list[SubmissionRowOut],
    summary="Every enrolled student with their submission status",
    operation_id="assignment_submissions_list",
)
@paginate(StandardPagination)
def list_submissions(request, assignment_id: int, filters: Query[StatusFilter]):
    return services.list_submissions(request.user, assignment_id, filters.status)


@router.put(
    "/{assignment_id}/submissions/{student_id}/grade",
    auth=faculty_or_admin,
    response={200: SubmissionRowOut, **WRITE_ERRORS},
    summary="Grade a submission (marks and optional feedback)",
    operation_id="assignment_submission_grade",
)
def grade_submission(request, assignment_id: int, student_id: int, payload: GradeIn):
    return services.grade(request.user, assignment_id, student_id, payload.marks_obtained, payload.feedback)


@router.get(
    "/{assignment_id}/export",
    auth=faculty_or_admin,
    response={200: None, **ERRORS},
    summary="Download the submissions as CSV",
    operation_id="assignment_submissions_export",
)
def export_submissions(request, assignment_id: int):
    filename, content = services.export_csv(request.user, assignment_id)
    response = HttpResponse(content, content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


# ------------------------------------------------------------------ student: submit / withdraw


@router.post(
    "/{assignment_id}/submission",
    auth=student_only,
    response={200: StudentAssignmentOut, **WRITE_ERRORS},
    summary="Submit or replace your file (multipart: file, note)",
    operation_id="assignment_submission_submit",
)
def submit(request, assignment_id: int, file: File[UploadedFile], note: Form[str] = ""):
    return services.submit(request.user, assignment_id, file, note)


@router.delete(
    "/{assignment_id}/submission",
    auth=student_only,
    response={204: None, **WRITE_ERRORS},
    summary="Withdraw your submission (only before it is graded)",
    operation_id="assignment_submission_withdraw",
)
def withdraw(request, assignment_id: int):
    services.withdraw(request.user, assignment_id)
    return Status(204, None)


# ------------------------------------------------------------------ download (student, owning faculty, admin)


@router.get(
    "/{assignment_id}/submissions/{student_id}/file",
    auth=require_role(Role.STUDENT, Role.FACULTY, Role.ADMIN),
    response={200: None, **ERRORS},
    summary="Download a submitted file (authenticated)",
    operation_id="assignment_submission_file",
)
def download(request, assignment_id: int, student_id: int):
    submission = services.get_downloadable(request.user, assignment_id, student_id)
    response = FileResponse(
        submission.file.open("rb"),
        as_attachment=True,
        filename=submission.original_name,
        content_type="application/octet-stream",
    )
    response["X-Content-Type-Options"] = "nosniff"
    response["Cache-Control"] = "private, no-store"
    return response


# ------------------------------------------------------------------ student: my assignments


@student_router.get(
    "/me/assignments",
    auth=student_only,
    response=list[StudentAssignmentOut],
    summary="My assignments with status, timing, marks and feedback",
    operation_id="students_me_assignments",
)
@paginate(StandardPagination)
def my_assignments(request, filters: Query[StudentFilters]):
    return services.student_assignments(request.user, filters.status, filters.subject)
