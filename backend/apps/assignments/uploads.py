"""Upload validation for submissions. Pure functions: no storage or request access."""

import posixpath
import re

# One source of truth for what students may upload. The frontend mirrors this list in
# src/lib/upload-limits.ts; keep the two in step.
ALLOWED_EXTENSIONS = (
    "pdf",
    "doc",
    "docx",
    "ppt",
    "pptx",
    "xls",
    "xlsx",
    "txt",
    "png",
    "jpg",
    "jpeg",
    "zip",
)

_ZIP = (b"PK\x03\x04", b"PK\x05\x06")  # normal archive / empty archive
_OLE = (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",)  # legacy Office (doc, ppt, xls)

MAGIC: dict[str, tuple[bytes, ...]] = {
    "pdf": (b"%PDF-",),
    "png": (b"\x89PNG\r\n\x1a\n",),
    "jpg": (b"\xff\xd8\xff",),
    "jpeg": (b"\xff\xd8\xff",),
    "zip": _ZIP,
    "docx": _ZIP,
    "pptx": _ZIP,
    "xlsx": _ZIP,
    "doc": _OLE,
    "ppt": _OLE,
    "xls": _OLE,
}

_OFFICE = "application/vnd.openxmlformats-officedocument"
CONTENT_TYPES: dict[str, frozenset[str]] = {
    "pdf": frozenset({"application/pdf"}),
    "doc": frozenset({"application/msword"}),
    "docx": frozenset({f"{_OFFICE}.wordprocessingml.document"}),
    "ppt": frozenset({"application/vnd.ms-powerpoint"}),
    "pptx": frozenset({f"{_OFFICE}.presentationml.presentation"}),
    "xls": frozenset({"application/vnd.ms-excel"}),
    "xlsx": frozenset({f"{_OFFICE}.spreadsheetml.sheet"}),
    "txt": frozenset({"text/plain"}),
    "png": frozenset({"image/png"}),
    "jpg": frozenset({"image/jpeg"}),
    "jpeg": frozenset({"image/jpeg"}),
    "zip": frozenset({"application/zip", "application/x-zip-compressed", "multipart/x-zip"}),
}
# Browsers sometimes send nothing or a generic type; the magic-byte check still applies.
GENERIC_CONTENT_TYPES = frozenset({"", "application/octet-stream"})

MAX_NAME_LENGTH = 120
HEAD_BYTES = 8192

_CONTROL = re.compile(r"[\x00-\x1f\x7f]")


class UploadRejected(Exception):
    """The file cannot be accepted; the message is safe to show to the user."""


def sanitize_name(raw: str | None) -> str:
    """Keep the original file name for display and download, minus anything dangerous."""
    name = (raw or "").replace("\\", "/")
    name = posixpath.basename(name)
    name = _CONTROL.sub("", name).strip().strip(".")
    if len(name) > MAX_NAME_LENGTH:
        stem, dot, ext = name.rpartition(".")
        keep = MAX_NAME_LENGTH - (len(ext) + 1 if dot else 0)
        name = (stem[:keep] + dot + ext) if dot else name[:MAX_NAME_LENGTH]
    return name


def extension_of(name: str) -> str:
    return name.rpartition(".")[2].lower() if "." in name else ""


def _mb(max_bytes: int) -> str:
    value = max_bytes / (1024 * 1024)
    return f"{value:g} MB"


def validate_upload(
    *, name: str | None, size: int, content_type: str | None, head: bytes, max_bytes: int
) -> tuple[str, str]:
    """Return (clean display name, extension) or raise UploadRejected."""
    clean = sanitize_name(name)
    ext = extension_of(clean)
    allowed = ", ".join(e.upper() for e in ALLOWED_EXTENSIONS)

    if ext not in ALLOWED_EXTENSIONS:
        raise UploadRejected(f"This file type isn’t allowed. Upload one of: {allowed}.")
    if size <= 0:
        raise UploadRejected("The file is empty.")
    if size > max_bytes:
        raise UploadRejected(f"The file is too large. The limit is {_mb(max_bytes)}.")

    declared = (content_type or "").split(";")[0].strip().lower()
    if declared not in GENERIC_CONTENT_TYPES and declared not in CONTENT_TYPES[ext]:
        raise UploadRejected(f"The file’s type ({declared}) doesn’t match its .{ext} extension.")

    if ext == "txt":
        if b"\x00" in head[:HEAD_BYTES]:
            raise UploadRejected("The file doesn’t look like plain text.")
    elif not any(head.startswith(sig) for sig in MAGIC[ext]):
        raise UploadRejected(f"The file’s contents don’t look like a real .{ext} file.")

    return clean, ext
