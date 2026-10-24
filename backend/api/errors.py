"""Standard error envelope used by every endpoint.

{"error": {"code": "not_found", "message": "...", "details": null}}
"""

import logging
from typing import Any

from django.core.exceptions import PermissionDenied
from django.http import Http404, HttpRequest, HttpResponse
from ninja import NinjaAPI, Schema
from ninja.errors import HttpError, ValidationError
from ninja_extra.exceptions import APIException

logger = logging.getLogger(__name__)

_DEFAULT_CODES = {
    400: "bad_request",
    401: "not_authenticated",
    403: "permission_denied",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    422: "validation_error",
}


class ErrorBody(Schema):
    code: str
    message: str
    details: Any | None = None


class ErrorOut(Schema):
    error: ErrorBody


class APIError(Exception):
    """Raise from services to produce a standard error response."""

    def __init__(
        self, status_code: int, code: str | None = None, message: str = "", details: Any = None
    ):
        self.status_code = status_code
        self.code = code or _DEFAULT_CODES.get(status_code, f"http_{status_code}")
        self.message = message
        self.details = details
        super().__init__(message)


def _respond(
    api: NinjaAPI, request: HttpRequest, status: int, code: str, message: str, details: Any = None
) -> HttpResponse:
    body = {"error": {"code": code, "message": message, "details": details}}
    return api.create_response(request, body, status=status)


def _detail_message(detail: Any, fallback: str) -> str:
    if isinstance(detail, dict):
        detail = detail.get("detail", fallback)
    return str(detail) if detail else fallback


def register_exception_handlers(api: NinjaAPI) -> None:
    @api.exception_handler(APIError)
    def handle_api_error(request, exc: APIError):
        return _respond(api, request, exc.status_code, exc.code, exc.message, exc.details)

    @api.exception_handler(ValidationError)
    def handle_validation_error(request, exc: ValidationError):
        return _respond(
            api, request, 422, "validation_error", "Request validation failed.", exc.errors
        )

    # Also covers ninja's AuthenticationError / AuthorizationError subclasses.
    @api.exception_handler(HttpError)
    def handle_http_error(request, exc: HttpError):
        code = _DEFAULT_CODES.get(exc.status_code, f"http_{exc.status_code}")
        return _respond(api, request, exc.status_code, code, str(exc.message))

    @api.exception_handler(APIException)  # raised by ninja-jwt (invalid/expired token, ...)
    def handle_extra_api_exception(request, exc: APIException):
        code = _DEFAULT_CODES.get(exc.status_code, f"http_{exc.status_code}")
        message = _detail_message(exc.detail, "Request failed.")
        return _respond(api, request, exc.status_code, code, message)

    @api.exception_handler(PermissionDenied)
    def handle_permission_denied(request, exc: PermissionDenied):
        message = str(exc) or "You do not have permission to perform this action."
        return _respond(api, request, 403, "permission_denied", message)

    @api.exception_handler(Http404)
    def handle_not_found(request, exc: Http404):
        return _respond(api, request, 404, "not_found", str(exc) or "Not found.")

    @api.exception_handler(Exception)
    def handle_unexpected(request, exc: Exception):
        logger.exception("Unhandled error in API", exc_info=exc)
        return _respond(api, request, 500, "server_error", "Internal server error.")
