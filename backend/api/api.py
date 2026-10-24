from ninja import NinjaAPI

from api.auth import jwt_auth
from api.errors import register_exception_handlers
from apps.accounts.api import router as auth_router

api = NinjaAPI(
    title="Student Saathi API",
    version="1.0.0",
    description="Student attendance and academic performance tracker.",
    auth=jwt_auth,  # secure by default; public endpoints opt out with auth=None
    docs_url="/docs",
)

register_exception_handlers(api)

api.add_router("/auth", auth_router)
