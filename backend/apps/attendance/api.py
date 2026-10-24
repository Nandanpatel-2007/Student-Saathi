import datetime as dt

from ninja import Query, Router, Schema, Status
from ninja.pagination import paginate

from api.auth import faculty_or_admin
from api.errors import ErrorOut
from api.pagination import StandardPagination

from . import services
from .schemas import RecordsUpdateIn, SessionCreateIn, SessionDetailOut, SessionOut

router = Router(tags=["Attendance"])

ERRORS = {401: ErrorOut, 403: ErrorOut, 404: ErrorOut}
WRITE_ERRORS = {**ERRORS, 409: ErrorOut, 422: ErrorOut}


class SessionFilters(Schema):
    subject: int | None = None
    section: int | None = None
    date_from: dt.date | None = None
    date_to: dt.date | None = None


@router.post(
    "/sessions",
    auth=faculty_or_admin,
    response={201: SessionDetailOut, **WRITE_ERRORS},
    summary="Create a session and pre-fill enrolled students as PRESENT",
    operation_id="attendance_sessions_create",
)
def create_session(request, payload: SessionCreateIn):
    session = services.create_session(
        request.user,
        payload.teaching_assignment_id,
        payload.date,
        payload.period,
        payload.topic,
    )
    return Status(201, session)


@router.get(
    "/sessions",
    auth=faculty_or_admin,
    response=list[SessionOut],
    summary="List attendance sessions (admin: all; faculty: own classes)",
    operation_id="attendance_sessions_list",
)
@paginate(StandardPagination)
def list_sessions(request, filters: Query[SessionFilters]):
    return services.list_sessions(
        request.user, filters.subject, filters.section, filters.date_from, filters.date_to
    )


@router.get(
    "/sessions/{session_id}",
    auth=faculty_or_admin,
    response={200: SessionDetailOut, **ERRORS},
    summary="Get a session with all student records",
    operation_id="attendance_sessions_get",
)
def get_session(request, session_id: int):
    return services.get_session_detail(request.user, session_id)


@router.put(
    "/sessions/{session_id}/records",
    auth=faculty_or_admin,
    response={200: SessionDetailOut, **WRITE_ERRORS},
    summary="Bulk update student statuses (audited)",
    operation_id="attendance_records_update",
)
def update_records(request, session_id: int, payload: RecordsUpdateIn):
    return services.update_records(request.user, session_id, [r.dict() for r in payload.records])
