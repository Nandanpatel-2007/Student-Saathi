import datetime as dt

from ninja import Query, Router, Schema, Status
from ninja.pagination import paginate

from api.auth import faculty_or_admin, jwt_auth
from api.errors import ErrorOut
from api.pagination import StandardPagination

from . import services
from .models import AssessmentType
from .schemas import (
    AssessmentCreateIn,
    AssessmentOut,
    AssessmentUpdateIn,
    MarksSheetOut,
    MarksUpdateIn,
)

router = Router(tags=["Assessments"])

ERRORS = {401: ErrorOut, 403: ErrorOut, 404: ErrorOut}
WRITE_ERRORS = {**ERRORS, 422: ErrorOut}


class AssessmentFilters(Schema):
    teaching_assignment_id: int | None = None
    subject: int | None = None
    section: int | None = None
    type: AssessmentType | None = None
    date_from: dt.date | None = None
    date_to: dt.date | None = None


@router.get(
    "",
    auth=jwt_auth,
    response=list[AssessmentOut],
    summary="List assessments (admin: all; faculty: own classes; student: own classes)",
    operation_id="assessments_list",
)
@paginate(StandardPagination)
def list_assessments(request, filters: Query[AssessmentFilters]):
    return services.list_assessments(
        request.user,
        filters.teaching_assignment_id,
        filters.subject,
        filters.section,
        filters.type,
        filters.date_from,
        filters.date_to,
    )


@router.post(
    "",
    auth=faculty_or_admin,
    response={201: AssessmentOut, **WRITE_ERRORS},
    summary="Create an assessment",
    operation_id="assessments_create",
)
def create_assessment(request, payload: AssessmentCreateIn):
    return Status(201, services.create_assessment(request.user, payload.dict()))


@router.get(
    "/{assessment_id}",
    auth=jwt_auth,
    response={200: AssessmentOut, **ERRORS},
    summary="Get an assessment",
    operation_id="assessments_get",
)
def get_assessment(request, assessment_id: int):
    return services.get_assessment(request.user, assessment_id)


@router.put(
    "/{assessment_id}",
    auth=faculty_or_admin,
    response={200: AssessmentOut, **WRITE_ERRORS},
    summary="Replace an assessment's details",
    operation_id="assessments_update",
)
def update_assessment(request, assessment_id: int, payload: AssessmentUpdateIn):
    return services.update_assessment(request.user, assessment_id, payload.dict())


@router.delete(
    "/{assessment_id}",
    auth=faculty_or_admin,
    response={204: None, **ERRORS},
    summary="Delete an assessment and its marks",
    operation_id="assessments_delete",
)
def delete_assessment(request, assessment_id: int):
    services.delete_assessment(request.user, assessment_id)
    return Status(204, None)


@router.get(
    "/{assessment_id}/marks",
    auth=jwt_auth,
    response={200: MarksSheetOut, **ERRORS},
    summary="Get marks for the class roster (students see only their own row)",
    operation_id="assessment_marks_get",
)
def get_marks(request, assessment_id: int):
    return services.get_marks_sheet(request.user, assessment_id)


@router.put(
    "/{assessment_id}/marks",
    auth=faculty_or_admin,
    response={200: MarksSheetOut, **WRITE_ERRORS},
    summary="Bulk enter or update marks",
    operation_id="assessment_marks_update",
)
def update_marks(request, assessment_id: int, payload: MarksUpdateIn):
    return services.update_marks(request.user, assessment_id, [m.dict() for m in payload.marks])
