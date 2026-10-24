"""Standard page-number pagination for every list endpoint.

    @router.get("/things", response=list[ThingOut])
    @paginate(StandardPagination)
    def list_things(request): ...

Response: {"items": [...], "count": N, "page": 1, "page_size": 20, "total_pages": K}
"""

import math
from typing import Any

from django.conf import settings
from ninja import Field, Schema
from ninja.pagination import PaginationBase


class StandardPagination(PaginationBase):
    class Input(Schema):
        page: int = Field(1, ge=1, description="1-based page number")
        page_size: int | None = Field(None, ge=1, description="Items per page (server maximum applies)")

    class Output(Schema):
        items: list[Any]
        count: int
        page: int
        page_size: int
        total_pages: int

    items_attribute = "items"

    def paginate_queryset(self, queryset, pagination: Input, **params):
        page_size = min(pagination.page_size or settings.DEFAULT_PAGE_SIZE, settings.MAX_PAGE_SIZE)
        count = (
            queryset.count()
            if hasattr(queryset, "count") and not isinstance(queryset, list)
            else len(queryset)
        )
        offset = (pagination.page - 1) * page_size
        return {
            "items": queryset[offset : offset + page_size],
            "count": count,
            "page": pagination.page,
            "page_size": page_size,
            "total_pages": math.ceil(count / page_size) if count else 0,
        }
