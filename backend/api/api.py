from ninja import NinjaAPI

from apps.academics.api import (
    assignments_router as teaching_assignments_router,
)
from apps.academics.api import (
    enrollments_router,
    faculty_router,
    sections_router,
    subjects_router,
)
from apps.accounts.admin_api import router as admin_router
from apps.accounts.api import router as auth_router
from apps.analytics.api import faculty_router as analytics_faculty_router
from apps.analytics.api import student_router as analytics_student_router
from apps.assessments.api import router as assessments_router
from apps.assignments.api import router as assignments_router
from apps.assignments.api import student_router as student_assignments_router
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
api.add_router("/admin", admin_router)
api.add_router("/subjects", subjects_router)
api.add_router("/sections", sections_router)
api.add_router("/enrollments", enrollments_router)
api.add_router("/teaching-assignments", teaching_assignments_router)
api.add_router("/faculty", faculty_router)
api.add_router("/attendance", attendance_router)
api.add_router("/assessments", assessments_router)
api.add_router("/assignments", assignments_router)
api.add_router("/students", student_assignments_router)
api.add_router("/students", analytics_student_router)
api.add_router("/faculty", analytics_faculty_router)
