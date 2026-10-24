from ninja import NinjaAPI

from apps.academics.api import (
    assignments_router,
    enrollments_router,
    faculty_router,
    sections_router,
    subjects_router,
)
from apps.accounts.api import router as auth_router
from apps.attendance.api import router as attendance_router

from .errors import register_error_handlers

api = NinjaAPI(
    title="Student Saathi API",
    version="1.0.0",
    description="Student attendance and academic performance tracker.",
    docs_url="/docs",
)

register_error_handlers(api)

api.add_router("/auth", auth_router)
api.add_router("/subjects", subjects_router)
api.add_router("/sections", sections_router)
api.add_router("/enrollments", enrollments_router)
api.add_router("/teaching-assignments", assignments_router)
api.add_router("/faculty", faculty_router)
api.add_router("/attendance", attendance_router)
