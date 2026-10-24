from ninja import NinjaAPI

from apps.accounts.api import router as auth_router

from .errors import register_error_handlers

api = NinjaAPI(
    title="Student Saathi API",
    version="1.0.0",
    description="Student attendance and academic performance tracker.",
    docs_url="/docs",
)

register_error_handlers(api)

api.add_router("/auth", auth_router)
