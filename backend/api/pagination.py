"""Page-number pagination shared by every list endpoint.

Usage:  @router.get("", response=list[ThingOut]) @paginate  (picked up via NINJA_PAGINATION_CLASS)
Query:  ?page=1&page_size=20
Result: {"items": [...], "count": 57, "page": 1, "page_size": 20, "total_pages": 3}
"""

import math
from typing import Any

from django.conf import settings
from ninja import Field, Schema
from ninja.pagination import PaginationBase


class StandardPagination(PaginationBase):
    class Input(Schema):
        page: int = Field(1, ge=1)
        page_size: int | None = Field(None, ge=1)

    class Output(Schema):
        items: list[Any]
        count: int
        page: int
        page_size: int
        total_pages: int

    def paginate_queryset(self, queryset, pagination: Input, **params: Any) -> dict:
        max_size = settings.PAGINATION_MAX_PAGE_SIZE
        page_size = min(pagination.page_size or settings.PAGINATION_DEFAULT_PAGE_SIZE, max_size)
        count = self._items_count(queryset)
        offset = (pagination.page - 1) * page_size
        return {
            "items": queryset[offset : offset + page_size],
            "count": count,
            "page": pagination.page,
            "page_size": page_size,
            "total_pages": math.ceil(count / page_size),
        }
