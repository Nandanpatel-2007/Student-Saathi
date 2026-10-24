from ninja import Query, Router, Schema
from ninja.pagination import paginate

from api.auth import admin_only
from api.errors import ErrorOut
from api.pagination import StandardPagination

from . import admin_services
from .admin_schemas import FacultyLookupOut, OverviewOut, StudentLookupOut

router = Router(tags=["Admin"])

ERRORS = {401: ErrorOut, 403: ErrorOut}


class FacultyFilters(Schema):
    search: str | None = None


class StudentFilters(Schema):
    search: str | None = None
    section_id: int | None = None


@router.get(
    "/overview",
    auth=admin_only,
    response={200: OverviewOut, **ERRORS},
    summary="Counts for the admin overview",
    operation_id="admin_overview",
)
def overview(request):
    return admin_services.overview()


@router.get(
    "/faculty",
    auth=admin_only,
    response=list[FacultyLookupOut],
    summary="Look up faculty members (admin)",
    operation_id="admin_faculty_list",
)
@paginate(StandardPagination)
def list_faculty(request, filters: Query[FacultyFilters]):
    return admin_services.list_faculty(filters.search)


@router.get(
    "/students",
    auth=admin_only,
    response=list[StudentLookupOut],
    summary="Look up students (admin)",
    operation_id="admin_students_list",
)
@paginate(StandardPagination)
def list_students(request, filters: Query[StudentFilters]):
    return admin_services.list_students(filters.search, filters.section_id)
