"""Standard error envelope for every non-2xx response.

{"error": {"code": "not_found", "message": "Not found", "details": [...]}}
"""

import logging

from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.http import Http404
from ninja import NinjaAPI, Schema
from ninja.errors import HttpError
from ninja.errors import ValidationError as NinjaValidationError
from ninja_extra.exceptions import APIException

logger = logging.getLogger(__name__)

STATUS_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    422: "validation_error",
    429: "throttled",
}


class ErrorDetail(Schema):
    field: str | None = None
    message: str


class ErrorBody(Schema):
    code: str
    message: str
    details: list[ErrorDetail] = []


class ErrorOut(Schema):
    error: ErrorBody


def error_payload(code: str, message: str, details: list[dict] | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details or []}}


def _respond(api: NinjaAPI, request, status: int, message: str, code: str | None = None, details=None):
    code = code or STATUS_CODES.get(status, "error")
    return api.create_response(request, error_payload(code, message, details), status=status)


def register_error_handlers(api: NinjaAPI) -> None:
    @api.exception_handler(NinjaValidationError)
    def validation_error(request, exc):
        details = [
            {
                "field": ".".join(str(part) for part in err.get("loc", [])) or None,
                "message": err.get("msg", "Invalid value"),
            }
            for err in exc.errors
        ]
        return _respond(api, request, 422, "Request validation failed", details=details)

    @api.exception_handler(HttpError)
    def http_error(request, exc):
        return _respond(api, request, exc.status_code, str(exc))

    @api.exception_handler(APIException)
    def jwt_error(request, exc):
        # django-ninja-jwt raises these for bad/expired tokens.
        detail = exc.detail
        message = str(detail.get("detail", detail)) if isinstance(detail, dict) else str(detail)
        return _respond(api, request, exc.status_code, message)

    @api.exception_handler(Http404)
    def not_found(request, exc):
        return _respond(api, request, 404, "Not found")

    @api.exception_handler(PermissionDenied)
    def permission_denied(request, exc):
        return _respond(api, request, 403, str(exc) or "You do not have permission to perform this action")

    @api.exception_handler(Exception)
    def server_error(request, exc):
        if settings.DEBUG:
            raise exc
        logger.exception("Unhandled error", exc_info=exc)
        return _respond(api, request, 500, "Internal server error", code="server_error")
