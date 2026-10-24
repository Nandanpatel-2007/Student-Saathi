from typing import Literal

from django.http import HttpResponse
from ninja import Router
from ninja.pagination import paginate

from api.auth import faculty_or_admin, require_role
from api.errors import ErrorOut
from api.pagination import StandardPagination
from apps.accounts.models import Role

from . import reports
from .schemas import ClassStudentOut, ClassSummaryOut, StudentDashboardOut

student_router = Router(tags=["Analytics"])
faculty_router = Router(tags=["Analytics"])

ERRORS = {401: ErrorOut, 403: ErrorOut, 404: ErrorOut}


@student_router.get(
    "/me/dashboard",
    auth=require_role(Role.STUDENT),
    response={200: StudentDashboardOut, **ERRORS},
    summary="Logged-in student's attendance, scores, alerts and trend",
    operation_id="students_me_dashboard",
)
def my_dashboard(request):
    return reports.student_dashboard(request.user)


@faculty_router.get(
    "/classes/{assignment_id}/summary",
    auth=faculty_or_admin,
    response={200: ClassSummaryOut, **ERRORS},
    summary="Class attendance, marks distribution and at-risk students",
    operation_id="faculty_class_summary",
)
def class_summary(request, assignment_id: int):
    return reports.class_summary(request.user, assignment_id)


@faculty_router.get(
    "/classes/{assignment_id}/students",
    auth=faculty_or_admin,
    response=list[ClassStudentOut],
    summary="Per-student attendance and score for a class",
    operation_id="faculty_class_students",
)
@paginate(StandardPagination)
def class_students(request, assignment_id: int):
    return reports.class_students(request.user, assignment_id)


@faculty_router.get(
    "/classes/{assignment_id}/export",
    auth=faculty_or_admin,
    response={200: None, **ERRORS},
    summary="Download the class attendance or marks sheet as CSV",
    operation_id="faculty_class_export",
)
def export_class(request, assignment_id: int, type: Literal["attendance", "marks"]):
    filename, content = reports.export_class_csv(request.user, assignment_id, type)
    response = HttpResponse(content, content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response
